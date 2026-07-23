using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConvertSocialMessageToJobCommand(
    Guid MessageId,
    Guid? ActorUserId,
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    string Priority,
    DateTimeOffset? DueDateUtc,
    // "Birim Dışı Talep Oluştur" formu alanları (card 443); verilmezse eski vatandaş talebi davranışı korunur.
    string? RequestType = null,
    IReadOnlyList<Guid>? TargetDepartmentIds = null,
    bool IsProject = false,
    DateTimeOffset? StartDateUtc = null,
    string? Neighborhood = null,
    string? Street = null,
    string? OpenAddress = null,
    string? CitizenName = null,
    string? CitizenPhone = null) : ICommand<JobSummaryResponse?>;

public sealed class ConvertSocialMessageToJobCommandValidator : AbstractValidator<ConvertSocialMessageToJobCommand>
{
    public ConvertSocialMessageToJobCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
        RuleFor(c => c.OwnerDepartmentId).NotEmpty().WithMessage("Sahip mudurluk zorunludur.");
    }
}

public sealed class ConvertSocialMessageToJobCommandHandler : ICommandHandler<ConvertSocialMessageToJobCommand, JobSummaryResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IMediator _sender;
    private readonly ICitizenJobStatusNotifier _citizenJobStatusNotifier;

    public ConvertSocialMessageToJobCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IMediator sender,
        ICitizenJobStatusNotifier citizenJobStatusNotifier)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _sender = sender;
        _citizenJobStatusNotifier = citizenJobStatusNotifier;
    }

    public async ValueTask<JobSummaryResponse?> Handle(ConvertSocialMessageToJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        _ = await ActorAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        var message = await _dbContext.SocialMessages.FirstOrDefaultAsync(
            e => e.SocialMessageId == request.MessageId && e.TenantId == tenantId, cancellationToken);
        if (message is null) return null;

        if (message.JobId.HasValue)
        {
            var existingJob = await _dbContext.Jobs.FirstOrDefaultAsync(
                j => j.JobId == message.JobId.Value && j.TenantId == tenantId, cancellationToken);
            if (existingJob is not null)
            {
                return await JobSummaryResponseFactory.CreateAsync(_dbContext, existingJob, cancellationToken);
            }
        }

        var jobSummary = await _sender.Send(new CreateJobCommand(
            request.ActorUserId,
            request.Title,
            request.Description,
            request.OwnerDepartmentId,
            OwnerUserIds: null,
            request.Priority,
            RequestType: request.RequestType ?? JobRequestType.Citizen.ToString(),
            IsProject: request.IsProject,
            CitizenName: ResolveCitizenName(request.CitizenName, message.CitizenHandle),
            CitizenPhone: ResolveCitizenPhone(request.CitizenPhone, message.CitizenHandle),
            StartDateUtc: request.StartDateUtc,
            request.DueDateUtc,
            TargetDepartmentIds: request.TargetDepartmentIds,
            SourceType: JobSourceType.SocialMessage.ToString(),
            SourceRefId: message.SocialMessageId,
            Latitude: message.Latitude,
            Longitude: message.Longitude,
            Neighborhood: request.Neighborhood,
            Street: request.Street,
            OpenAddress: request.OpenAddress), cancellationToken);

        message.JobId = jobSummary.JobId;
        message.Status = SocialMessageStatus.ConvertedToTask;
        message.AssignedDepartmentId = ResolveDestinationDepartmentId(request.TargetDepartmentIds, request.OwnerDepartmentId);
        message.UpdatedByUserId = request.ActorUserId;
        message.UpdatedAtUtc = DateTimeOffset.UtcNow;

        // Vatandaş Çağrı / operatör talepleri WhatsApp webhook'u geçmez; CitizenConversation
        // upsert ile Vatandaş Bilgi Listesi'nde görünsün (card #1858).
        await EnsureCitizenConversationAsync(
            tenantId,
            message,
            ResolveCitizenName(request.CitizenName, message.CitizenHandle),
            ResolveCitizenPhone(request.CitizenPhone, message.CitizenHandle),
            request.Neighborhood,
            request.Street,
            request.OpenAddress,
            cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            j => j.JobId == jobSummary.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is not null)
        {
            var taskCount = await _dbContext.Tasks.CountAsync(
                t => t.JobId == job.JobId && t.TenantId == tenantId, cancellationToken);
            await _citizenJobStatusNotifier.NotifyCreatedAsync(tenantId, message, job, taskCount, cancellationToken);
        }

        return jobSummary;
    }

    private static string? ResolveCitizenName(string? requestedName, string citizenHandle)
    {
        if (!string.IsNullOrWhiteSpace(requestedName))
        {
            return requestedName.Trim();
        }

        return LooksLikePhone(citizenHandle) ? null : citizenHandle.Trim();
    }

    private static string? ResolveCitizenPhone(string? requestedPhone, string citizenHandle)
    {
        if (!string.IsNullOrWhiteSpace(requestedPhone))
        {
            return requestedPhone.Trim();
        }

        return LooksLikePhone(citizenHandle) ? NormalizePhoneDigits(citizenHandle) : null;
    }

    private static bool LooksLikePhone(string value)
    {
        var digits = NormalizePhoneDigits(value);
        return digits.Length is >= 10 and <= 12;
    }

    private static string NormalizePhoneDigits(string value)
        => new(value.Where(char.IsDigit).ToArray());

    private async Task EnsureCitizenConversationAsync(
        Guid tenantId,
        SocialMessage message,
        string? citizenName,
        string? citizenPhone,
        string? neighborhood,
        string? street,
        string? openAddress,
        CancellationToken cancellationToken)
    {
        if (message.CitizenConversationId.HasValue)
        {
            var existingLinked = await _dbContext.CitizenConversations
                .FirstOrDefaultAsync(
                    conversation => conversation.CitizenConversationId == message.CitizenConversationId.Value
                        && conversation.TenantId == tenantId,
                    cancellationToken);
            if (existingLinked is not null)
            {
                ApplyConversationProfile(existingLinked, citizenName, neighborhood, street, openAddress);
                existingLinked.LastMessageAt = DateTimeOffset.UtcNow;
                return;
            }
        }

        var normalizedPhone = NormalizeConversationPhone(citizenPhone);
        if (normalizedPhone is null)
        {
            return;
        }

        var phoneVariants = ConversationPhoneVariants(normalizedPhone);
        var conversation = await _dbContext.CitizenConversations
            .FirstOrDefaultAsync(
                item => item.TenantId == tenantId && phoneVariants.Contains(item.CitizenPhone),
                cancellationToken);

        if (conversation is null)
        {
            conversation = new CitizenConversation
            {
                CitizenConversationId = Guid.NewGuid(),
                TenantId = tenantId,
                CitizenPhone = normalizedPhone,
                LastMessageAt = DateTimeOffset.UtcNow,
                UnreadCount = 0,
            };
            _dbContext.CitizenConversations.Add(conversation);
        }
        else
        {
            conversation.LastMessageAt = DateTimeOffset.UtcNow;
        }

        ApplyConversationProfile(conversation, citizenName, neighborhood, street, openAddress);
        message.CitizenConversationId = conversation.CitizenConversationId;
    }

    private static void ApplyConversationProfile(
        CitizenConversation conversation,
        string? citizenName,
        string? neighborhood,
        string? street,
        string? openAddress)
    {
        if (!string.IsNullOrWhiteSpace(citizenName))
        {
            conversation.CitizenName = citizenName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(neighborhood))
        {
            conversation.Neighborhood = neighborhood.Trim();
        }

        if (!string.IsNullOrWhiteSpace(street))
        {
            conversation.Street = street.Trim();
        }

        if (!string.IsNullOrWhiteSpace(openAddress))
        {
            conversation.OpenAddress = openAddress.Trim();
        }
    }

    /// <summary>E.164 TR storage: 905XXXXXXXXX (WhatsApp CitizenConversation ile aynı).</summary>
    private static string? NormalizeConversationPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        var digits = NormalizePhoneDigits(phone);
        if (digits.Length == 10)
        {
            return "90" + digits;
        }

        if (digits.Length == 11 && digits.StartsWith('0'))
        {
            return "90" + digits[1..];
        }

        if (digits.Length == 12 && digits.StartsWith("90", StringComparison.Ordinal))
        {
            return digits;
        }

        return digits.Length is >= 10 and <= 15 ? digits : null;
    }

    private static IReadOnlyList<string> ConversationPhoneVariants(string normalizedPhone)
    {
        var variants = new HashSet<string>(StringComparer.Ordinal) { normalizedPhone };
        if (normalizedPhone.Length == 12 && normalizedPhone.StartsWith("90", StringComparison.Ordinal))
        {
            variants.Add(normalizedPhone[2..]);
            variants.Add("0" + normalizedPhone[2..]);
        }

        return variants.ToArray();
    }

    private static Guid? ResolveDestinationDepartmentId(IReadOnlyList<Guid>? targetDepartmentIds, Guid ownerDepartmentId)
    {
        var destinationDepartmentId = targetDepartmentIds?
            .FirstOrDefault(departmentId => departmentId != Guid.Empty && departmentId != ownerDepartmentId);
        if (destinationDepartmentId is Guid resolved && resolved != Guid.Empty)
        {
            return resolved;
        }

        destinationDepartmentId = targetDepartmentIds?.FirstOrDefault(departmentId => departmentId != Guid.Empty);
        return destinationDepartmentId is Guid fallback && fallback != Guid.Empty
            ? fallback
            : null;
    }
}
