namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record AddSupportDepartmentCommand(Guid JobId, Guid DepartmentId, Guid? ActorUserId, string? Notes) : ICommand<bool>;

public sealed class AddSupportDepartmentCommandHandler : IRequestHandler<AddSupportDepartmentCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public AddSupportDepartmentCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(AddSupportDepartmentCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
            _dbContext, actor, job.OwnerDepartmentId, "Destek ekleme yetkiniz yok.", cancellationToken);

        if (job.Status != JobStatus.Active)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.JobId), "Sadece aktif islere destek eklenebilir.")
            ]);
        }

        var exists = await _dbContext.JobDepartments.AnyAsync(
            e => e.JobId == job.JobId && e.DepartmentId == request.DepartmentId, cancellationToken);
        if (exists)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.DepartmentId), "Bu departman zaten ise baglid.")
            ]);
        }

        _dbContext.JobDepartments.Add(new JobDepartment
        {
            JobDepartmentId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            JobId = job.JobId,
            DepartmentId = request.DepartmentId,
            Role = JobDepartmentRole.Support,
            ApprovalStatus = JobApprovalStatus.NotRequired,
            RequestedByUserId = actor.UserId,
            RequestedAtUtc = utcNow,
            Notes = request.Notes,
            CreatedByUserId = actor.UserId
        });

        job.IsCoordinated = true;
        job.UpdatedAtUtc = utcNow;
        job.UpdatedByUserId = actor.UserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId.Value,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobSupportAdded",
            ActorUserId = actor.UserId,
            Details = request.DepartmentId.ToString()
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}

public sealed record CancelJobCommand(Guid JobId, Guid? ActorUserId, string Reason) : ICommand<bool>;

public sealed class CancelJobCommandValidator : AbstractValidator<CancelJobCommand>
{
    public CancelJobCommandValidator() { RuleFor(c => c.Reason).NotEmpty().WithMessage("Iptal nedeni zorunludur."); }
}

public sealed class CancelJobCommandHandler : IRequestHandler<CancelJobCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CancelJobCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(CancelJobCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var utcNow = DateTimeOffset.UtcNow;
        var job = await _dbContext.Jobs.FirstOrDefaultAsync(j => j.JobId == request.JobId, cancellationToken);
        if (job is null) return false;

        var actor = await JobWorkflowAuthorization.RequireActorAsync(_dbContext, request.ActorUserId, cancellationToken);
        await JobWorkflowAuthorization.EnsureManagesDepartmentAsync(
            _dbContext, actor, job.OwnerDepartmentId, "Is iptal yetkiniz yok.", cancellationToken);

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
            TenantId = context.TenantId!.Value,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = "JobCancelled",
            ActorUserId = actor.UserId,
            Details = request.Reason
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
