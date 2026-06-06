namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record ApproveJobOwnerCommand(Guid JobId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class ApproveJobOwnerCommandHandler : ICommandHandler<ApproveJobOwnerCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISlaCalculatorService _slaCalculator;

    public ApproveJobOwnerCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor, ISlaCalculatorService slaCalculator)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _slaCalculator = slaCalculator;
    }

    public async ValueTask<bool> Handle(ApproveJobOwnerCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
            _dbContext, actor, job.OwnerDepartmentId, "Is sahibi onay yetkiniz yok.", cancellationToken);

        if (job.Status != JobStatus.PendingOwnerApproval)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Sadece sahip onayi bekleyen isler onaylanabilir.")
            ]);
        }

        var ownerDept = await _dbContext.JobDepartments
            .Where(e => e.JobId == job.JobId && e.Role == JobDepartmentRole.Owner)
            .FirstOrDefaultAsync(cancellationToken);
        if (ownerDept is not null)
        {
            ownerDept.ApprovalStatus = JobApprovalStatus.Approved;
            ownerDept.ApprovedByUserId = actor.UserId;
            ownerDept.DecidedAtUtc = utcNow;
            ownerDept.UpdatedAtUtc = utcNow;
            ownerDept.UpdatedByUserId = actor.UserId;
        }

        var targets = await _dbContext.JobDepartments
            .Where(e => e.JobId == job.JobId && e.Role == JobDepartmentRole.Target)
            .ToListAsync(cancellationToken);

        // Always assign the job number when the owner approves
        if (job.JobNumber is null)
        {
            job.JobNumberYear = utcNow.Year;
            job.JobNumber = await SequenceNumberHelper.NextJobNumberAsync(_dbContext, tenantId, utcNow.Year, cancellationToken);
        }

        // One-step approval: the owner manager's approval activates the job directly.
        // For external (birim dışı) requests the job drops into the target department's
        // pool as Active — there is no separate target-manager approval step.
        var createdTaskCount = 0;
        job.Status = JobStatus.Active;
        if (job.DueDateUtc is null)
        {
            var settings = await _dbContext.TenantSettings.FirstOrDefaultAsync(cancellationToken);
            if (settings is not null && settings.DefaultSlaHours > 0)
            {
                job.DueDateUtc = await _slaCalculator.CalculateDueDateAsync(
                    utcNow, settings.DefaultSlaHours, tenantId, job.OwnerDepartmentId, cancellationToken);
            }
        }
        if (targets.Count > 0)
        {
            // External: accept the targets into their pool. The target department
            // assigns its own staff afterwards, so no owner tasks are created here.
            foreach (var t in targets)
            {
                t.ApprovalStatus = JobApprovalStatus.Approved;
                t.ApprovedByUserId = actor.UserId;
                t.DecidedAtUtc = utcNow;
                t.UpdatedAtUtc = utcNow;
                t.UpdatedByUserId = actor.UserId;
            }
        }
        else
        {
            // Internal: the owner department does the work — provision owner tasks.
            createdTaskCount = await JobOwnerTaskProvisioning.EnsureOwnerTasksAsync(
                _dbContext, tenantId, job, actor.UserId, utcNow, cancellationToken);
        }

        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobOwnerApproved",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = request.Comment,
            Details = string.IsNullOrWhiteSpace(request.Comment)
                ? $"CreatedTasks={createdTaskCount}"
                : $"{request.Comment} CreatedTasks={createdTaskCount}"
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record RejectJobOwnerCommand(Guid JobId, Guid? ActorUserId, string Reason) : ICommand<bool>;

public sealed class RejectJobOwnerCommandValidator : AbstractValidator<RejectJobOwnerCommand>
{
    public RejectJobOwnerCommandValidator() { RuleFor(c => c.Reason).NotEmpty().WithMessage("Red nedeni zorunludur."); }
}

public sealed class RejectJobOwnerCommandHandler : ICommandHandler<RejectJobOwnerCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public RejectJobOwnerCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(RejectJobOwnerCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
            _dbContext, actor, job.OwnerDepartmentId, "Is sahibi red yetkiniz yok.", cancellationToken);

        if (job.Status != JobStatus.PendingOwnerApproval)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Sadece sahip onayi bekleyen isler reddedilebilir.")
            ]);
        }

        var ownerDept = await _dbContext.JobDepartments
            .FirstOrDefaultAsync(e => e.JobId == job.JobId && e.Role == JobDepartmentRole.Owner, cancellationToken);
        if (ownerDept is not null)
        {
            ownerDept.ApprovalStatus = JobApprovalStatus.Rejected;
            ownerDept.ApprovedByUserId = actor.UserId;
            ownerDept.DecidedAtUtc = utcNow;
            ownerDept.RejectReason = request.Reason;
            ownerDept.UpdatedAtUtc = utcNow;
            ownerDept.UpdatedByUserId = actor.UserId;
        }

        job.Status = JobStatus.Rejected;
        job.CancelReason = request.Reason;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobOwnerRejected",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = JobStatus.Rejected.ToString(),
            Notes = request.Reason,
            Details = request.Reason
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
