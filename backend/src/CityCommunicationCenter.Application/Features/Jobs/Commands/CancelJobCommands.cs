using CityCommunicationCenter.Application.Abstractions;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

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

        var isCreator = job.CreatedByUserId == actor.UserId;
        var isOwnerManager = !isCreator && await _dbContext.Departments
            .AnyAsync(d => d.TenantId == tenantId && d.DepartmentId == job.OwnerDepartmentId && d.ManagerUserId == actor.UserId, cancellationToken);
        // Hedef birim yöneticisi, onay bekleyen veya aktif (ör. Üst Düzey Yönetici'den gelen) birim dışı talebi iptal edebilir.
        var isTargetManager = !isCreator && !isOwnerManager &&
            (job.Status == JobStatus.PendingExternalApproval || job.Status == JobStatus.Active) &&
            await _dbContext.JobDepartments.AnyAsync(
                jd => jd.JobId == job.JobId && jd.Role == JobDepartmentRole.Target &&
                      _dbContext.Departments.Any(d => d.TenantId == tenantId && d.DepartmentId == jd.DepartmentId && d.ManagerUserId == actor.UserId),
                cancellationToken);

        if (!isCreator && !isOwnerManager && !isTargetManager)
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
        job.CompletionPercentage = 0;
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

        // Talep iptal edildiğinde, onaylanmış olsa bile devam eden tüm görevler de iptale düşer.
        var activeTasks = await _dbContext.Tasks
            .Where(t => t.JobId == job.JobId && t.TenantId == tenantId
                     && t.CurrentStatus != WorkflowTaskStatus.Completed
                     && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                     && t.CurrentStatus != WorkflowTaskStatus.Rejected)
            .ToListAsync(cancellationToken);

        foreach (var task in activeTasks)
        {
            task.CurrentStatus = WorkflowTaskStatus.Cancelled;
            task.RevisionReason = request.Reason;
            task.UpdatedAtUtc = utcNow;
            task.UpdatedByUserId = actor.UserId;

            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(WorkTask),
                EntityId = task.TaskId.ToString(),
                Action = "TaskCancelled",
                ActorUserId = actor.UserId,
                ActorDisplayName = actor.DisplayName,
                StatusAtEvent = WorkflowTaskStatus.Cancelled.ToString(),
                Notes = "Bağlı talep iptal edildiği için görev iptal edildi.",
                Details = request.Reason
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
