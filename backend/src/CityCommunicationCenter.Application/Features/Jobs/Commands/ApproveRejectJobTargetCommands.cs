namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record ApproveJobTargetCommand(Guid JobId, Guid DepartmentId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class ApproveJobTargetCommandHandler : ICommandHandler<ApproveJobTargetCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ApproveJobTargetCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ApproveJobTargetCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
            _dbContext, actor, request.DepartmentId, "Hedef departman onay yetkiniz yok.", cancellationToken);

        var jd = await _dbContext.JobDepartments.FirstOrDefaultAsync(
            e => e.JobId == job.JobId && e.DepartmentId == request.DepartmentId
            && (e.Role == JobDepartmentRole.Target || e.Role == JobDepartmentRole.Support),
            cancellationToken);
        if (jd is null)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Hedef/destek kaydi bulunamadi.")
            ]);
        }

        if (jd.ApprovalStatus != JobApprovalStatus.Pending)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Sadece onay bekleyen kayitlar onaylanabilir.")
            ]);
        }

        jd.ApprovalStatus = JobApprovalStatus.Approved;
        jd.ApprovedByUserId = actor.UserId;
        jd.DecidedAtUtc = utcNow;
        jd.UpdatedAtUtc = utcNow;
        jd.UpdatedByUserId = actor.UserId;

        var all = await _dbContext.JobDepartments.Where(e => e.JobId == job.JobId).ToListAsync(cancellationToken);
        var ownerOk = all.Any(x => x.Role == JobDepartmentRole.Owner && x.ApprovalStatus == JobApprovalStatus.Approved);
        var targetsOk = all.Where(x => x.Role == JobDepartmentRole.Target)
            .All(x => x.ApprovalStatus == JobApprovalStatus.Approved || x.ApprovalStatus == JobApprovalStatus.NotRequired);

        if (ownerOk && targetsOk)
        {
            job.Status = JobStatus.Active;
            job.UpdatedAtUtc = utcNow;
            job.UpdatedByUserId = actor.UserId;
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobTargetApproved",
            ActorUserId = actor.UserId,
            Details = $"Dept={request.DepartmentId} {request.Comment}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record RejectJobTargetCommand(Guid JobId, Guid DepartmentId, Guid? ActorUserId, string Reason) : ICommand<bool>;

public sealed class RejectJobTargetCommandValidator : AbstractValidator<RejectJobTargetCommand>
{
    public RejectJobTargetCommandValidator() { RuleFor(c => c.Reason).NotEmpty().WithMessage("Red nedeni zorunludur."); }
}

public sealed class RejectJobTargetCommandHandler : ICommandHandler<RejectJobTargetCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public RejectJobTargetCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(RejectJobTargetCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
            _dbContext, actor, request.DepartmentId, "Hedef departman red yetkiniz yok.", cancellationToken);

        var jd = await _dbContext.JobDepartments.FirstOrDefaultAsync(
            e => e.JobId == job.JobId && e.DepartmentId == request.DepartmentId
            && (e.Role == JobDepartmentRole.Target || e.Role == JobDepartmentRole.Support),
            cancellationToken);
        if (jd is null || jd.ApprovalStatus != JobApprovalStatus.Pending)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Onay bekleyen kayit bulunamadi.")
            ]);
        }

        jd.ApprovalStatus = JobApprovalStatus.Rejected;
        jd.ApprovedByUserId = actor.UserId;
        jd.DecidedAtUtc = utcNow;
        jd.RejectReason = request.Reason;
        jd.UpdatedAtUtc = utcNow;
        jd.UpdatedByUserId = actor.UserId;

        // if the only target and rejected, mark job as Rejected
        var anyTargetApproved = await _dbContext.JobDepartments.AnyAsync(
            e => e.JobId == job.JobId
                && e.Role == JobDepartmentRole.Target
                && e.ApprovalStatus == JobApprovalStatus.Approved, cancellationToken);
        var anyTargetPending = await _dbContext.JobDepartments.AnyAsync(
            e => e.JobId == job.JobId
                && e.Role == JobDepartmentRole.Target
                && e.ApprovalStatus == JobApprovalStatus.Pending, cancellationToken);

        if (!anyTargetApproved && !anyTargetPending && jd.Role == JobDepartmentRole.Target)
        {
            job.Status = JobStatus.Rejected;
            job.CancelReason = request.Reason;
        }
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobTargetRejected",
            ActorUserId = actor.UserId,
            Details = request.Reason
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
