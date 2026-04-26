namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record CreateJobCommand(
    Guid? ActorUserId,
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    string Priority,
    string? RequestType,
    bool IsProject,
    string? CitizenName,
    string? CitizenPhone,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    IReadOnlyCollection<Guid>? TargetDepartmentIds,
    string? SourceType,
    Guid? SourceRefId) : ICommand<JobSummaryResponse>;

public sealed class CreateJobCommandValidator : AbstractValidator<CreateJobCommand>
{
    public CreateJobCommandValidator()
    {
        RuleFor(c => c.Title).NotEmpty().WithMessage("Is basligi zorunludur.");
        RuleFor(c => c.Description).NotEmpty().WithMessage("Is aciklamasi zorunludur.");
        RuleFor(c => c.OwnerDepartmentId).NotEmpty().WithMessage("Is sahibi mudurluk zorunludur.");
        RuleFor(c => c.Priority).NotEmpty().WithMessage("Oncelik zorunludur.");
    }
}

public sealed class CreateJobCommandHandler : ICommandHandler<CreateJobCommand, JobSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CreateJobCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<JobSummaryResponse> Handle(CreateJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        // Auth: Staff can only create for own dept, Manager for managed dept, Admin for any
        if (!JobWorkflowAuthorization.IsSystemAdmin(actor))
        {
            if (actor.RoleCode == RoleCode.Staff && actor.DepartmentId != request.OwnerDepartmentId)
            {
                throw new ForbiddenAccessException("Personel sadece kendi mudurlugu icin is olusturabilir.");
            }
            if (actor.RoleCode == RoleCode.Manager &&
                !await JobWorkflowAuthorization.ManagesDepartmentAsync(_dbContext, actor, request.OwnerDepartmentId, cancellationToken))
            {
                throw new ForbiddenAccessException("Mudur sadece yonettigi mudurluk icin is olusturabilir.");
            }
            if (actor.RoleCode != RoleCode.Staff && actor.RoleCode != RoleCode.Manager)
            {
                throw new ForbiddenAccessException("Bu rol is olusturamaz.");
            }
        }

        var ownerDept = await _dbContext.Departments.FirstOrDefaultAsync(
            d => d.DepartmentId == request.OwnerDepartmentId && d.TenantId == tenantId, cancellationToken)
            ?? throw Validation(nameof(request.OwnerDepartmentId), "Sahip mudurluk bulunamadi.");

        var targets = request.TargetDepartmentIds?
            .Where(id => id != request.OwnerDepartmentId)
            .Distinct()
            .ToArray() ?? [];

        var sourceType = Enum.TryParse<JobSourceType>(request.SourceType, true, out var st) ? st : JobSourceType.Manual;
        var requestType = Enum.TryParse<JobRequestType>(request.RequestType, true, out var rt)
            ? rt
            : sourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest
                ? JobRequestType.Citizen
                : targets.Length > 0
                    ? JobRequestType.ExternalUnit
                    : JobRequestType.InternalUnit;

        var job = new Job
        {
            JobId = Guid.NewGuid(),
            TenantId = tenantId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            OwnerDepartmentId = request.OwnerDepartmentId,
            Status = JobStatus.Active,
            Priority = request.Priority.Trim(),
            RequestType = requestType,
            IsProject = request.IsProject,
            CitizenName = string.IsNullOrWhiteSpace(request.CitizenName) ? null : request.CitizenName.Trim(),
            CitizenPhone = string.IsNullOrWhiteSpace(request.CitizenPhone) ? null : request.CitizenPhone.Trim(),
            StartDateUtc = request.StartDateUtc,
            DueDateUtc = request.DueDateUtc,
            SourceType = sourceType,
            SourceRefId = request.SourceRefId,
            IsCoordinated = targets.Length > 0,
            CreatedByUserId = context.UserId
        };

        _dbContext.Jobs.Add(job);

        _dbContext.JobDepartments.Add(new JobDepartment
        {
            JobDepartmentId = Guid.NewGuid(),
            TenantId = tenantId,
            JobId = job.JobId,
            DepartmentId = request.OwnerDepartmentId,
            Role = JobDepartmentRole.Owner,
            ApprovalStatus = JobApprovalStatus.Approved,
            RequestedByUserId = actor.UserId,
            RequestedAtUtc = utcNow,
            ApprovedByUserId = actor.UserId,
            DecidedAtUtc = utcNow,
            CreatedByUserId = context.UserId
        });

        foreach (var targetDeptId in targets)
        {
            _dbContext.JobDepartments.Add(new JobDepartment
            {
                JobDepartmentId = Guid.NewGuid(),
                TenantId = tenantId,
                JobId = job.JobId,
                DepartmentId = targetDeptId,
                Role = JobDepartmentRole.Target,
                ApprovalStatus = JobApprovalStatus.NotRequired,
                RequestedByUserId = actor.UserId,
                RequestedAtUtc = utcNow,
                CreatedByUserId = context.UserId
            });
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobCreated",
            ActorUserId = context.UserId,
            Details = $"Status=Active, Targets={targets.Length}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return await JobSummaryResponseFactory.CreateAsync(_dbContext, job, cancellationToken);
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}
