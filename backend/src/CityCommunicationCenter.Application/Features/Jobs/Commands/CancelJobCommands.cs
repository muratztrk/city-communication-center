namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record CancelJobCommand(Guid JobId, Guid? ActorUserId, string Reason) : ICommand<bool>;

public sealed class CancelJobCommandValidator : AbstractValidator<CancelJobCommand>
{
    public CancelJobCommandValidator() { RuleFor(c => c.Reason).NotEmpty().WithMessage("Iptal nedeni zorunludur."); }
}

public sealed class CancelJobCommandHandler : ICommandHandler<CancelJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CancelJobCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(CancelJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        var isOwnerManager = await _dbContext.Departments
            .AnyAsync(d => d.TenantId == tenantId && d.DepartmentId == job.OwnerDepartmentId && d.ManagerUserId == actor.UserId, cancellationToken);
        var isTargetManager = !isOwnerManager && job.Status == JobStatus.PendingExternalApproval &&
            await _dbContext.JobDepartments.AnyAsync(
                jd => jd.JobId == job.JobId && jd.Role == JobDepartmentRole.Target &&
                      _dbContext.Departments.Any(d => d.TenantId == tenantId && d.DepartmentId == jd.DepartmentId && d.ManagerUserId == actor.UserId),
                cancellationToken);

        if (!isOwnerManager && !isTargetManager)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "İş iptal yetkiniz yok.")
            ]);
        }

        if (job.Status is JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Bu is iptal edilemez.")
            ]);
        }

        job.Status = JobStatus.Cancelled;
        job.CancelReason = request.Reason;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobCancelled",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = JobStatus.Cancelled.ToString(),
            Notes = request.Reason,
            Details = request.Reason
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
