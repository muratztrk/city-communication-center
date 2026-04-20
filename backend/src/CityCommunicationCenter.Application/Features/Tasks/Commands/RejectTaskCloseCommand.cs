using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record RejectTaskCloseCommand(Guid TaskId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class RejectTaskCloseCommandHandler : IRequestHandler<RejectTaskCloseCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public RejectTaskCloseCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(RejectTaskCloseCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId, cancellationToken);
        if (task is null) return false;

        if (task.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Sadece kapanis onayi bekleyen gorevler reddedilebilir.")
            ]);
        }

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(e => e.JobId == task.JobId, cancellationToken)!;
        if (job is null) return false;

        await TaskWorkflowAuthorization.EnsureCanApproveTaskCloseAsync(_dbContext, task, job, request.ActorUserId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;
        task.CurrentStatus = WorkflowTaskStatus.InProgress;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        var pendingApproval = await _dbContext.Approvals
            .Where(e => e.SubjectType == ApprovalSubjectType.TaskClose
                && e.SubjectId == task.TaskId
                && e.Decision == ApprovalDecision.Pending)
            .OrderBy(e => e.StepOrder)
            .FirstOrDefaultAsync(cancellationToken);

        if (pendingApproval is not null)
        {
            pendingApproval.Decision = ApprovalDecision.Rejected;
            pendingApproval.ApproverUserId = request.ActorUserId ?? pendingApproval.ApproverUserId;
            pendingApproval.Comment = request.Comment ?? pendingApproval.Comment;
            pendingApproval.DecisionDateUtc = utcNow;
            pendingApproval.UpdatedAtUtc = utcNow;
            pendingApproval.UpdatedByUserId = request.ActorUserId;
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskCloseRejected",
            ActorUserId = request.ActorUserId,
            Details = request.Comment
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
