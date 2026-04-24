using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record ApproveTaskCloseCommand(Guid TaskId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class ApproveTaskCloseCommandHandler : ICommandHandler<ApproveTaskCloseCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ApproveTaskCloseCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ApproveTaskCloseCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        if (task.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval)
        {
            throw Validation(nameof(request.TaskId), "Sadece kapanis onayi bekleyen gorevler onaylanabilir.");
        }

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(e => e.JobId == task.JobId && e.TenantId == tenantId, cancellationToken)!
            ?? throw Validation(nameof(request.TaskId), "Gorev icin is bulunamadi.");

        await TaskWorkflowAuthorization.EnsureCanApproveTaskCloseAsync(_dbContext, task, job, request.ActorUserId, tenantId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;
        task.CurrentStatus = WorkflowTaskStatus.Completed;
        task.CompletedAtUtc = utcNow;
        task.CompletionPercentage = 100;
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
            pendingApproval.Decision = ApprovalDecision.Approved;
            pendingApproval.ApproverUserId = request.ActorUserId ?? pendingApproval.ApproverUserId;
            pendingApproval.Comment = request.Comment ?? pendingApproval.Comment;
            pendingApproval.DecisionDateUtc = utcNow;
            pendingApproval.UpdatedAtUtc = utcNow;
            pendingApproval.UpdatedByUserId = request.ActorUserId;
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskCloseApproved",
            ActorUserId = request.ActorUserId,
            Details = request.Comment
        });

        await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, task.JobId, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}
