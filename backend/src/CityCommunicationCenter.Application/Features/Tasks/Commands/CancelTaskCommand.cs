using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CancelTaskCommand(Guid TaskId, Guid? ActorUserId, string Reason) : ICommand<bool>;

public sealed class CancelTaskCommandValidator : AbstractValidator<CancelTaskCommand>
{
    public CancelTaskCommandValidator()
    {
        RuleFor(c => c.Reason).NotEmpty().WithMessage("İptal nedeni zorunludur.");
    }
}

public sealed class CancelTaskCommandHandler : ICommandHandler<CancelTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CancelTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(CancelTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var task = await _dbContext.Tasks.FirstOrDefaultAsync(
            e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled)
            throw new ValidationException([new FluentValidation.Results.ValidationFailure(
                nameof(request.TaskId), "Tamamlanmış veya zaten iptal edilmiş görev iptal edilemez.")]);

        var actor = await TaskWorkflowAuthorization.RequireActiveActorAsync(
            _dbContext, request.ActorUserId, tenantId, cancellationToken);

        if (!TaskWorkflowAuthorization.IsSystemAdmin(actor))
        {
            var job = await _dbContext.Jobs.FirstOrDefaultAsync(
                e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken);

            var isAssignee = task.AssignedUserId == actor.UserId;
            var managesAssignedDept = await TaskWorkflowAuthorization.IsManagerOfAsync(
                _dbContext, actor, task.AssignedDepartmentId, cancellationToken);
            var managesOwnerDept = job is not null && await TaskWorkflowAuthorization.IsManagerOfAsync(
                _dbContext, actor, job.OwnerDepartmentId, cancellationToken);

            if (!isAssignee && !managesAssignedDept && !managesOwnerDept)
                throw new ForbiddenAccessException("Bu görevi iptal etme yetkiniz yok.");
        }

        var utcNow = DateTimeOffset.UtcNow;
        task.CurrentStatus = WorkflowTaskStatus.Cancelled;
        task.RevisionReason = request.Reason;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskCancelled",
            ActorUserId = request.ActorUserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = WorkflowTaskStatus.Cancelled.ToString(),
            Notes = request.Reason,
            Details = request.Reason
        });

        var parentJob = await _dbContext.Jobs.FirstOrDefaultAsync(
            e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken);

        // Rutin olmayan dış birim talebi: tüm görevler iptal olduysa iş tekrar onay beklemeye döner
        if (parentJob is not null
            && parentJob.SourceType != JobSourceType.Routine
            && parentJob.RequestType == JobRequestType.ExternalUnit
            && parentJob.Status == JobStatus.Active)
        {
            var remainingActive = await _dbContext.Tasks
                .Where(t => t.JobId == parentJob.JobId
                         && t.TaskId != task.TaskId
                         && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                         && t.CurrentStatus != WorkflowTaskStatus.Completed
                         && t.CurrentStatus != WorkflowTaskStatus.Rejected)
                .AnyAsync(cancellationToken);

            if (!remainingActive)
            {
                parentJob.Status = JobStatus.PendingOwnerApproval;
                parentJob.CompletionPercentage = 0;
                parentJob.UpdatedAtUtc = utcNow;
                parentJob.UpdatedByUserId = request.ActorUserId;

                _dbContext.AuditLogs.Add(new AuditLog
                {
                    AuditLogId = Guid.NewGuid(),
                    TenantId = tenantId,
                    EntityType = nameof(Job),
                    EntityId = parentJob.JobId.ToString(),
                    Action = "JobReturnedToPending",
                    ActorUserId = request.ActorUserId,
                    ActorDisplayName = actor.DisplayName,
                    StatusAtEvent = JobStatus.PendingOwnerApproval.ToString(),
                    Notes = "Tüm görevler iptal edildi; talep yeniden onay sürecine döndürüldü.",
                    Details = request.Reason
                });
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // İç birim / vatandaş talepleri: tüm görevler iptal/tamamlandıysa talep durumunu güncelle
        if (parentJob is not null && parentJob.RequestType != JobRequestType.ExternalUnit)
        {
            await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, task.JobId, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return true;
    }
}
