using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CompleteTaskCommand(Guid TaskId, Guid? ActorUserId, string? ResultNote, decimal? ActualHours) : ICommand<bool>;

public sealed class CompleteTaskCommandHandler : IRequestHandler<CompleteTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CompleteTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(CompleteTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId, cancellationToken);
        if (task is null) return false;

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled)
        {
            throw Validation(nameof(request.TaskId), "Tamamlanmis veya iptal edilmis gorev yeniden tamamlanamaz.");
        }

        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(_dbContext, task, request.ActorUserId, cancellationToken);

        var utcNow = DateTimeOffset.UtcNow;
        task.ActualHours = request.ActualHours ?? task.ActualHours;
        if (!string.IsNullOrWhiteSpace(request.ResultNote))
        {
            task.Notes = request.ResultNote;
        }

        var requiresApproval = task.AssigningManagerId.HasValue;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        if (requiresApproval)
        {
            task.CurrentStatus = WorkflowTaskStatus.PendingCloseApproval;
            var stepOrder = await _dbContext.Approvals.CountAsync(
                e => e.SubjectType == ApprovalSubjectType.TaskClose && e.SubjectId == task.TaskId, cancellationToken) + 1;

            _dbContext.Approvals.Add(new WorkflowApproval
            {
                ApprovalId = Guid.NewGuid(),
                TenantId = context.TenantId!.Value,
                SubjectType = ApprovalSubjectType.TaskClose,
                SubjectId = task.TaskId,
                StepOrder = stepOrder,
                ApproverUserId = task.AssigningManagerId ?? Guid.Empty,
                Decision = ApprovalDecision.Pending,
                Comment = request.ResultNote,
                CreatedByUserId = request.ActorUserId
            });

            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = context.TenantId.Value,
                EntityType = nameof(WorkTask),
                EntityId = task.TaskId.ToString(),
                Action = "TaskCloseRequested",
                ActorUserId = request.ActorUserId,
                Details = request.ResultNote
            });
        }
        else
        {
            task.CurrentStatus = WorkflowTaskStatus.Completed;
            task.CompletedAtUtc = utcNow;
            task.CompletionPercentage = 100;

            _dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = context.TenantId!.Value,
                EntityType = nameof(WorkTask),
                EntityId = task.TaskId.ToString(),
                Action = "TaskCompleted",
                ActorUserId = request.ActorUserId,
                Details = request.ResultNote
            });

            await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, task.JobId, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ValidationException Validation(string p, string m) =>
        new([new FluentValidation.Results.ValidationFailure(p, m)]);
}
