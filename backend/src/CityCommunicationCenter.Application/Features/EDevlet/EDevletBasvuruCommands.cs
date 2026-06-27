using System.Text.Json;
using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Application.Features.EDevlet;

public sealed record GetEDevletBasvurularQuery(string? Status = null) : IQuery<IReadOnlyList<EDevletBasvuruSummaryResponse>>;

public sealed class GetEDevletBasvurularQueryHandler : IQueryHandler<GetEDevletBasvurularQuery, IReadOnlyList<EDevletBasvuruSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetEDevletBasvurularQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<EDevletBasvuruSummaryResponse>> Handle(
        GetEDevletBasvurularQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var query = _dbContext.EDevletBasvurular
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(request.Status)
            && Enum.TryParse<EDevletBasvuruStatus>(request.Status, true, out var status))
        {
            query = query.Where(entity => entity.Status == status);
        }

        return await query
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .Select(entity => new EDevletBasvuruSummaryResponse(
                entity.BasvuruId,
                entity.TakipNo,
                entity.CitizenFirstName,
                entity.CitizenLastName,
                entity.BasvuruTipi,
                entity.Description,
                entity.MahalleAdi,
                entity.SokakCaddeAdi,
                entity.Status.ToString(),
                entity.CreatedAtUtc,
                entity.JobId,
                entity.Job != null && entity.Job.JobNumber.HasValue && entity.Job.JobNumberYear.HasValue
                    ? $"T-{entity.Job.JobNumberYear}-{entity.Job.JobNumber}"
                    : null))
            .ToListAsync(cancellationToken);
    }
}

public sealed record GetEDevletBasvuruByIdQuery(Guid BasvuruId) : IQuery<EDevletBasvuruDetailResponse?>;

public sealed class GetEDevletBasvuruByIdQueryHandler : IQueryHandler<GetEDevletBasvuruByIdQuery, EDevletBasvuruDetailResponse?>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetEDevletBasvuruByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<EDevletBasvuruDetailResponse?> Handle(
        GetEDevletBasvuruByIdQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var basvuru = await _dbContext.EDevletBasvurular
            .AsNoTracking()
            .Include(entity => entity.Attachments)
            .FirstOrDefaultAsync(entity => entity.BasvuruId == request.BasvuruId && entity.TenantId == tenantId, cancellationToken);

        if (basvuru is null)
        {
            return null;
        }

        return new EDevletBasvuruDetailResponse(
            basvuru.BasvuruId,
            basvuru.TakipNo,
            basvuru.CitizenTcKimlikNo,
            basvuru.CitizenFirstName,
            basvuru.CitizenLastName,
            basvuru.BasvuruTipi,
            basvuru.Description,
            basvuru.Email,
            DeserializePhones(basvuru.PhoneNumbersJson),
            basvuru.IlceAdi,
            basvuru.MahalleAdi,
            basvuru.SokakCaddeAdi,
            basvuru.DisKapiNo,
            basvuru.IcKapiNo,
            basvuru.OpenAddress,
            basvuru.Latitude,
            basvuru.Longitude,
            basvuru.CevapSekli,
            basvuru.Status.ToString(),
            basvuru.CreatedAtUtc,
            basvuru.JobId,
            basvuru.Attachments.Select(attachment => new EDevletBasvuruAttachmentResponse(
                attachment.AttachmentId,
                attachment.DosyaCesidi,
                attachment.OriginalFileName,
                attachment.ContentType,
                attachment.SizeBytes)).ToList());
    }

    private static IReadOnlyList<string> DeserializePhones(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }
}

public sealed record ConvertEDevletBasvuruToJobCommand(
    Guid BasvuruId,
    Guid? ActorUserId,
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    string Priority,
    IReadOnlyCollection<Guid>? TargetDepartmentIds,
    DateTimeOffset? DueDateUtc,
    string? Neighborhood,
    string? Street,
    string? OpenAddress,
    string? CitizenName,
    string? CitizenPhone) : ICommand<JobSummaryResponse?>;

public sealed class ConvertEDevletBasvuruToJobCommandValidator : AbstractValidator<ConvertEDevletBasvuruToJobCommand>
{
    public ConvertEDevletBasvuruToJobCommandValidator()
    {
        RuleFor(command => command.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(command => command.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(command => command.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
        RuleFor(command => command.OwnerDepartmentId).NotEmpty().WithMessage("Sahip mudurluk zorunludur.");
    }
}

public sealed class ConvertEDevletBasvuruToJobCommandHandler : ICommandHandler<ConvertEDevletBasvuruToJobCommand, JobSummaryResponse?>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IMediator _sender;

    public ConvertEDevletBasvuruToJobCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IMediator sender)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _sender = sender;
    }

    public async ValueTask<JobSummaryResponse?> Handle(
        ConvertEDevletBasvuruToJobCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        _ = await ActorAuthorization.RequireActiveActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        var basvuru = await _dbContext.EDevletBasvurular
            .FirstOrDefaultAsync(entity => entity.BasvuruId == request.BasvuruId && entity.TenantId == tenantId, cancellationToken);
        if (basvuru is null)
        {
            return null;
        }

        if (basvuru.Status == EDevletBasvuruStatus.ConvertedToJob && basvuru.JobId.HasValue)
        {
            var existingJob = await _dbContext.Jobs.FirstOrDefaultAsync(
                job => job.JobId == basvuru.JobId.Value && job.TenantId == tenantId,
                cancellationToken);
            if (existingJob is not null)
            {
                return await JobSummaryResponseFactory.CreateAsync(_dbContext, existingJob, cancellationToken);
            }
        }

        if (basvuru.Status != EDevletBasvuruStatus.PendingReview)
        {
            throw ValidationExceptionFactory.Field(nameof(request.BasvuruId), "Yalnizca onay bekleyen e-Devlet basvurulari is akisina alinabilir.");
        }

        var citizenName = string.IsNullOrWhiteSpace(request.CitizenName)
            ? $"{basvuru.CitizenFirstName} {basvuru.CitizenLastName}".Trim()
            : request.CitizenName.Trim();
        var citizenPhone = string.IsNullOrWhiteSpace(request.CitizenPhone)
            ? DeserializePhones(basvuru.PhoneNumbersJson).FirstOrDefault()
            : request.CitizenPhone.Trim();

        var jobSummary = await _sender.Send(new CreateJobCommand(
            request.ActorUserId,
            request.Title,
            request.Description,
            request.OwnerDepartmentId,
            OwnerUserIds: null,
            request.Priority,
            RequestType: JobRequestType.Citizen.ToString(),
            IsProject: false,
            CitizenName: citizenName,
            CitizenPhone: citizenPhone,
            StartDateUtc: null,
            request.DueDateUtc,
            TargetDepartmentIds: request.TargetDepartmentIds,
            SourceType: JobSourceType.EDevlet.ToString(),
            SourceRefId: basvuru.BasvuruId,
            Latitude: basvuru.Latitude,
            Longitude: basvuru.Longitude,
            Neighborhood: request.Neighborhood ?? basvuru.MahalleAdi,
            Street: request.Street ?? basvuru.SokakCaddeAdi,
            OpenAddress: request.OpenAddress ?? basvuru.OpenAddress), cancellationToken);

        basvuru.JobId = jobSummary.JobId;
        basvuru.Status = EDevletBasvuruStatus.ConvertedToJob;
        basvuru.UpdatedByUserId = request.ActorUserId;
        basvuru.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return jobSummary;
    }

    private static IReadOnlyList<string> DeserializePhones(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return Array.Empty<string>();
        }
    }
}
