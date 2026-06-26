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
    string? OpenAddress = null,
    IReadOnlyCollection<Guid>? TargetDepartmentIds = null,
    string? CitizenName = null,
    string? CitizenPhone = null) : ICommand<bool>;

public sealed class UpdateJobCommandValidator : AbstractValidator<UpdateJobCommand>
{
    public UpdateJobCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
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
            && job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest
            && (job.Status == JobStatus.PendingExternalApproval
                || (job.Status == JobStatus.Active && !hasTasks));

        if (actor.RoleCode is not Domain.Enums.RoleCode.SystemAdmin
            && job.CreatedByUserId != actor.UserId
            && !canOperatorEditCitizenRequest)
        {
            await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
                _dbContext, actor, job.OwnerDepartmentId, "Bu isi duzenleme yetkiniz yok.", cancellationToken);
        }

        var utcNow = DateTimeOffset.UtcNow;
        job.Title = request.Title;
        job.Description = request.Description;
        job.Priority = request.Priority;
        job.StartDateUtc = request.StartDateUtc;
        job.DueDateUtc = request.DueDateUtc;
        job.Latitude = request.Latitude;
        job.Longitude = request.Longitude;
        // null = değiştirme; verilen alanlar (boş string dahil) güncellenir (card 452).
        if (request.IsProject.HasValue) job.IsProject = request.IsProject.Value;
        if (request.Neighborhood is not null) job.Neighborhood = string.IsNullOrWhiteSpace(request.Neighborhood) ? null : request.Neighborhood;
        if (request.Street is not null) job.Street = string.IsNullOrWhiteSpace(request.Street) ? null : request.Street;
        if (request.OpenAddress is not null) job.OpenAddress = string.IsNullOrWhiteSpace(request.OpenAddress) ? null : request.OpenAddress;
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
            Notes = $"Title updated: {job.Title}",
            Details = $"Title={job.Title}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
