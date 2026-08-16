using CityCommunicationCenter.Application.Common;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record UpdateJobCommand(
    Guid JobId,
    Guid? ActorUserId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    double? Latitude,
    double? Longitude,
    // Talep Oluştur sayfasından tam düzenleme için ek alanlar (card 452); null = değiştirme.
    bool? IsProject = null,
    string? Neighborhood = null,
    string? Street = null,
    string? StreetNo = null,
    string? OpenAddress = null,
    IReadOnlyCollection<Guid>? TargetDepartmentIds = null,
    string? CitizenName = null,
    string? CitizenPhone = null,
    string? LocationMapsUrl = null) : ICommand<bool>;

public sealed class UpdateJobCommandValidator : AbstractValidator<UpdateJobCommand>
{
    public UpdateJobCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
        RuleFor(c => c.Street).MaximumLength(AddressFieldLimits.StreetMaxLength)
            .WithMessage("Cadde / Sokak en fazla 50 karakter olabilir.");
        RuleFor(c => c.StreetNo).MaximumLength(AddressFieldLimits.StreetNoMaxLength)
            .WithMessage("No en fazla 20 karakter olabilir.");
        RuleFor(c => c.OpenAddress).MaximumLength(AddressFieldLimits.OpenAddressMaxLength)
            .WithMessage("Açık Adres en fazla 100 karakter olabilir.");
    }
}

public sealed class UpdateJobCommandHandler : ICommandHandler<UpdateJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateJobCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateJobCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var job = await _dbContext.Jobs
            .FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);

        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        // Talep tamamlanmadıysa veya iptal/reddedilmediyse düzenlenebilir; Yapılmakta (Active) talepler
        // de yönetici tarafından düzenlenebilir (card #724).
        if (job.Status is JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Tamamlanmış veya iptal edilmiş talepler düzenlenemez.")
            ]);
        }

        var hasTasks = await _dbContext.Tasks
            .AnyAsync(t => t.JobId == job.JobId && t.TenantId == tenantId, cancellationToken);

        var canOperatorEditCitizenRequest = actor.RoleCode == RoleCode.Operator
            && job.RequestType == JobRequestType.ExternalUnit
            && job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest or JobSourceType.EDevlet
            && (job.Status == JobStatus.PendingExternalApproval
                || (job.Status == JobStatus.Active && !hasTasks));

        if (actor.RoleCode is not Domain.Enums.RoleCode.SystemAdmin
            && job.CreatedByUserId != actor.UserId
            && !canOperatorEditCitizenRequest)
        {
            var managesOwner = await JobWorkflowAuthorization.ManagesDepartmentAsync(
                _dbContext, actor, job.OwnerDepartmentId, cancellationToken);
            if (!managesOwner)
            {
                // Birime Gelen hedef birim yöneticisi (özellikle Birim dışı) Son Tarih vb.
                // güncelleyebilsin — yalnızca Owner kontrolü 403 veriyordu (card #1673).
                var targetDepartmentIds = await _dbContext.JobDepartments
                    .Where(jd => jd.JobId == job.JobId
                        && jd.TenantId == tenantId
                        && jd.Role == JobDepartmentRole.Target)
                    .Select(jd => jd.DepartmentId)
                    .ToListAsync(cancellationToken);
                var managesTarget = false;
                foreach (var targetDepartmentId in targetDepartmentIds)
                {
                    if (await JobWorkflowAuthorization.ManagesDepartmentAsync(
                            _dbContext, actor, targetDepartmentId, cancellationToken))
                    {
                        managesTarget = true;
                        break;
                    }
                }

                if (!managesTarget)
                {
                    throw new ForbiddenAccessException("Bu isi duzenleme yetkiniz yok.");
                }
            }
        }

        var utcNow = DateTimeOffset.UtcNow;
        var previousDueDateUtc = job.DueDateUtc;
        var previousTitle = job.Title;
        var previousDescription = job.Description;
        var previousPriority = job.Priority;
        var previousStartDateUtc = job.StartDateUtc;
        var previousLatitude = job.Latitude;
        var previousLongitude = job.Longitude;
        var previousNeighborhood = job.Neighborhood;
        var previousStreet = job.Street;
        var previousStreetNo = job.StreetNo;
        var previousOpenAddress = job.OpenAddress;
        var previousCitizenName = job.CitizenName;
        var previousCitizenPhone = job.CitizenPhone;
        var previousIsProject = job.IsProject;
        var previousIsProjectCreatorRequested = job.IsProjectCreatorRequested;
        job.Title = request.Title;
        job.Description = request.Description;
        job.Priority = request.Priority;
        job.StartDateUtc = request.StartDateUtc;
        job.DueDateUtc = request.DueDateUtc;
        job.Latitude = request.Latitude;
        job.Longitude = request.Longitude;
        // null = değiştirme; verilen alanlar (boş string dahil) güncellenir (card 452).
        if (request.IsProject.HasValue)
        {
            if (job.IsProjectOwnerConfirmed && request.IsProject.Value != job.IsProject)
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(nameof(request.IsProject), "Proje niteligi birim yoneticisi tarafindan onaylandiktan sonra degistirilemez.")
                ]);
            }

            if (job.Status == JobStatus.PendingOwnerApproval && !job.IsProjectOwnerConfirmed)
            {
                job.IsProjectCreatorRequested = request.IsProject.Value;
                job.IsProject = false;
            }
            else if (!job.IsProjectOwnerConfirmed)
            {
                job.IsProject = request.IsProject.Value;
            }
        }
        if (request.Neighborhood is not null) job.Neighborhood = string.IsNullOrWhiteSpace(request.Neighborhood) ? null : request.Neighborhood;
        if (request.Street is not null) job.Street = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street;
        if (request.StreetNo is not null) job.StreetNo = string.IsNullOrWhiteSpace(request.StreetNo) ? null : request.StreetNo;
        if (request.OpenAddress is not null) job.OpenAddress = string.IsNullOrWhiteSpace(request.OpenAddress) ? null : request.OpenAddress;
        if (request.LocationMapsUrl is not null) job.LocationMapsUrl = string.IsNullOrWhiteSpace(request.LocationMapsUrl) ? null : request.LocationMapsUrl.Trim();
        if (request.CitizenName is not null) job.CitizenName = string.IsNullOrWhiteSpace(request.CitizenName) ? null : request.CitizenName.Trim();
        if (request.CitizenPhone is not null) job.CitizenPhone = string.IsNullOrWhiteSpace(request.CitizenPhone) ? null : request.CitizenPhone.Trim();
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        // Birim dışı talepte hedef departmanlar değişebilir (yalnızca onay öncesi, görev yokken).
        // Owner satırı korunur; mevcut Target satırları silinip yeni seçim eklenir (card 452).
        // Active/Yapılmakta taleplerde hedef değişikliğine izin verilmez (card #724) — sadece temel
        // alanlar güncellenir; hedef değişikliği onay-öncesi durumlarla sınırlı kalır.
        // Vatandaş Talep Operatörü, sosyal kaynaklı birim dışı talebi hedef birim onaylamadan düzenleyebilir.
        var canOperatorEditTargetsBeforeTargetApproval = canOperatorEditCitizenRequest;

        var targetsChanged = false;
        if (request.TargetDepartmentIds is not null && job.RequestType == JobRequestType.ExternalUnit
            && (job.Status is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested
                || canOperatorEditTargetsBeforeTargetApproval))
        {
            var newTargetIds = request.TargetDepartmentIds
                .Where(id => id != Guid.Empty && id != job.OwnerDepartmentId)
                .Distinct()
                .ToArray();
            if (newTargetIds.Length > 1)
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(nameof(request.TargetDepartmentIds), "Talep icin yalnizca bir hedef birim secilebilir.")
                ]);
            }
            var existingTargets = await _dbContext.JobDepartments
                .Where(jd => jd.JobId == job.JobId && jd.TenantId == tenantId && jd.Role == JobDepartmentRole.Target)
                .ToListAsync(cancellationToken);
            var previousTargetIds = existingTargets.Select(jd => jd.DepartmentId).ToHashSet();
            targetsChanged = !previousTargetIds.SetEquals(newTargetIds);
            _dbContext.JobDepartments.RemoveRange(existingTargets);
            foreach (var targetId in newTargetIds)
            {
                _dbContext.JobDepartments.Add(new JobDepartment
                {
                    JobDepartmentId = Guid.NewGuid(),
                    TenantId = tenantId,
                    JobId = job.JobId,
                    DepartmentId = targetId,
                    Role = JobDepartmentRole.Target,
                    ApprovalStatus = JobApprovalStatus.NotRequired,
                    RequestedByUserId = actor.UserId,
                    RequestedAtUtc = utcNow,
                    CreatedByUserId = actor.UserId,
                });
            }
            job.IsCoordinated = false;

            var linkedMessages = await _dbContext.SocialMessages
                .Where(message => message.JobId == job.JobId && message.TenantId == tenantId)
                .ToListAsync(cancellationToken);
            var destinationDepartmentId = newTargetIds.FirstOrDefault();
            foreach (var linkedMessage in linkedMessages)
            {
                linkedMessage.AssignedDepartmentId = destinationDepartmentId == Guid.Empty
                    ? null
                    : destinationDepartmentId;
                linkedMessage.UpdatedAtUtc = utcNow;
                linkedMessage.UpdatedByUserId = actor.UserId;
            }
        }

        // Son tarih değişikliği: TaskDueDateUpdated ile aynı bildirim kalıbı (card #1677 reopen).
        // FE datetime-local dakika hassasiyeti → UtcTicks yerine dakika karşılaştırması.
        // "Yalnızca son tarih değiştiyse" koşulu KULLANILMAZ: diğer alanlardaki kozmetik bir
        // fark (ör. FE round-trip) bildirimi tamamen yutuyordu. Son tarih değiştiyse
        // JobDueDateUpdated HER ZAMAN yazılır; jenerik JobUpdated yalnız başka alan da
        // değiştiyse ek olarak yazılır.
        var dueDateChanged = DateChangedAtMinutePrecision(previousDueDateUtc, job.DueDateUtc);
        var otherFieldsChanged = targetsChanged
            || !string.Equals(previousTitle, job.Title, StringComparison.Ordinal)
            || !string.Equals(previousDescription, job.Description, StringComparison.Ordinal)
            || !string.Equals(previousPriority, job.Priority, StringComparison.Ordinal)
            || DateChangedAtMinutePrecision(previousStartDateUtc, job.StartDateUtc)
            || previousLatitude != job.Latitude
            || previousLongitude != job.Longitude
            || previousNeighborhood != job.Neighborhood
            || previousStreet != job.Street
            || previousStreetNo != job.StreetNo
            || previousOpenAddress != job.OpenAddress
            || previousCitizenName != job.CitizenName
            || previousCitizenPhone != job.CitizenPhone
            || previousIsProject != job.IsProject
            || previousIsProjectCreatorRequested != job.IsProjectCreatorRequested;
        if (dueDateChanged)
        {
            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(Job),
                EntityId = job.JobId.ToString(),
                Action = "JobDueDateUpdated",
                ActorUserId = actor.UserId,
                StatusAtEvent = job.Status.ToString(),
                Notes = job.DueDateUtc?.ToString("O"),
                Details = job.DueDateUtc?.ToString("O"),
            });
        }
        if (otherFieldsChanged || !dueDateChanged)
        {
            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(Job),
                EntityId = job.JobId.ToString(),
                Action = "JobUpdated",
                ActorUserId = actor.UserId,
                ActorDisplayName = actor.DisplayName,
                StatusAtEvent = job.Status.ToString(),
                Notes = $"Başlık güncellendi: {job.Title}",
                Details = $"Title={job.Title}"
            });
        }

        // Çağrı talebi adı/telefonu değişince yalnız phone-only konuşma profili eşleşir (#2288/#2330).
        // Job.CitizenName talep bazlı kalır; WA konuşma profiline yazılmaz.
        if (previousCitizenName != job.CitizenName || previousCitizenPhone != job.CitizenPhone)
        {
            await SyncCitizenConversationProfileAsync(
                tenantId,
                job,
                utcNow,
                actor.UserId,
                cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task SyncCitizenConversationProfileAsync(
        Guid tenantId,
        Job job,
        DateTimeOffset utcNow,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        var normalizedPhone = NormalizeConversationPhone(job.CitizenPhone);
        if (normalizedPhone is null)
        {
            return;
        }

        var linkedMessages = await _dbContext.SocialMessages
            .Where(message => message.JobId == job.JobId && message.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        if (linkedMessages.Count == 0 || !linkedMessages.All(message => message.Channel == SocialChannel.Phone))
        {
            return;
        }

        // Unique (TenantId, CitizenPhone): önce telefon sahibi; çakışmada eski konuşmanın
        // numarasını ezme — mesajları doğru konuşmaya taşı (#6a6f1d32).
        var phoneVariants = ConversationPhoneVariants(normalizedPhone);
        var phoneOwner = await _dbContext.CitizenConversations
            .FirstOrDefaultAsync(
                item => item.TenantId == tenantId && phoneVariants.Contains(item.CitizenPhone),
                cancellationToken);

        if (phoneOwner is not null
            && await CitizenConversationLinkGuard.ShouldSkipPhoneLinkToConversationAsync(
                _dbContext,
                tenantId,
                SocialChannel.Phone,
                phoneOwner.CitizenConversationId,
                cancellationToken))
        {
            return;
        }

        CitizenConversation? linked = null;
        var linkedConversationId = linkedMessages
            .Select(message => message.CitizenConversationId)
            .FirstOrDefault(id => id.HasValue);
        if (linkedConversationId is Guid conversationId)
        {
            linked = await _dbContext.CitizenConversations
                .FirstOrDefaultAsync(
                    item => item.CitizenConversationId == conversationId && item.TenantId == tenantId,
                    cancellationToken);
        }

        CitizenConversation conversation;
        if (phoneOwner is not null)
        {
            conversation = phoneOwner;
            if (!string.Equals(conversation.CitizenPhone, normalizedPhone, StringComparison.Ordinal))
            {
                conversation.CitizenPhone = normalizedPhone;
            }
        }
        else if (linked is not null)
        {
            linked.CitizenPhone = normalizedPhone;
            conversation = linked;
        }
        else
        {
            conversation = new CitizenConversation
            {
                CitizenConversationId = Guid.NewGuid(),
                TenantId = tenantId,
                CitizenPhone = normalizedPhone,
                LastMessageAt = utcNow,
                UnreadCount = 0,
                CreatedByUserId = actorUserId,
            };
            _dbContext.CitizenConversations.Add(conversation);
        }

        var hasWhatsAppOnConversation = await CitizenConversationLinkGuard.HasWhatsAppMessagesOnConversationAsync(
            _dbContext,
            tenantId,
            conversation.CitizenConversationId,
            cancellationToken);

        if (!hasWhatsAppOnConversation)
        {
            if (!string.IsNullOrWhiteSpace(job.CitizenName))
            {
                conversation.CitizenName = job.CitizenName.Trim();
            }

            // Talep adresi vatandaş profil adresinden ayrıdır (#2563).
        }

        conversation.LastMessageAt = utcNow;
        conversation.UpdatedAtUtc = utcNow;
        conversation.UpdatedByUserId = actorUserId;

        foreach (var message in linkedMessages)
        {
            message.CitizenConversationId = conversation.CitizenConversationId;
            message.UpdatedAtUtc = utcNow;
            message.UpdatedByUserId = actorUserId;
        }
    }

    /// <summary>E.164 TR storage: 905XXXXXXXXX (ConvertSocialMessageToJob ile aynı).</summary>
    private static string? NormalizeConversationPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        var digits = new string(phone.Where(char.IsDigit).ToArray());
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

    private static bool DateChangedAtMinutePrecision(DateTimeOffset? previous, DateTimeOffset? next)
    {
        if (previous is null && next is null) return false;
        if (previous is null || next is null) return true;
        return previous.Value.UtcDateTime.Ticks / TimeSpan.TicksPerMinute
            != next.Value.UtcDateTime.Ticks / TimeSpan.TicksPerMinute;
    }
}
