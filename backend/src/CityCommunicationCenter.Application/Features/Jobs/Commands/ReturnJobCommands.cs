namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record ReturnJobCommand(Guid JobId, Guid? ActorUserId, string Reason) : ICommand<bool>;

public sealed class ReturnJobCommandValidator : AbstractValidator<ReturnJobCommand>
{
    public ReturnJobCommandValidator() { RuleFor(c => c.Reason).NotEmpty().WithMessage("İade nedeni zorunludur."); }
}

public sealed class ReturnJobCommandHandler : ICommandHandler<ReturnJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ReturnJobCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ReturnJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var utcNow = DateTimeOffset.UtcNow;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, tenantId, cancellationToken);

        var isCreator = job.CreatedByUserId == actor.UserId;
        var isOwnerManager = await _dbContext.Departments
            .AnyAsync(d => d.DepartmentId == job.OwnerDepartmentId && d.TenantId == tenantId && d.ManagerUserId == actor.UserId, cancellationToken);
        var isTargetManager = !isCreator && !isOwnerManager && job.Status == JobStatus.PendingExternalApproval &&
            await _dbContext.JobDepartments.AnyAsync(
                jd => jd.JobId == job.JobId && jd.Role == JobDepartmentRole.Target &&
                      _dbContext.Departments.Any(d => d.TenantId == tenantId && d.DepartmentId == jd.DepartmentId && d.ManagerUserId == actor.UserId),
                cancellationToken);

        if (!isCreator && !isOwnerManager && !isTargetManager)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Bu talebi iade etme yetkiniz yok.")
            ]);
        }

        if (job.Status is JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Bu talep iade edilemez.")
            ]);
        }

        job.Status = JobStatus.RevisionRequested;
        job.CancelReason = request.Reason;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobReturnRequested",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = JobStatus.RevisionRequested.ToString(),
            Notes = request.Reason,
            Details = request.Reason
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
