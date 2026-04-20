using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record ClaimTaskFromPoolCommand(Guid TaskId, Guid? ActorUserId) : ICommand<bool>;

public sealed class ClaimTaskFromPoolCommandHandler : IRequestHandler<ClaimTaskFromPoolCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ClaimTaskFromPoolCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(ClaimTaskFromPoolCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId, cancellationToken);
        if (task is null) return false;

        var actor = await TaskWorkflowAuthorization.EnsureCanClaimFromPoolAsync(_dbContext, task, request.ActorUserId, cancellationToken);
        if (!TaskWorkflowAuthorization.IsClaimableFromDepartmentPool(task))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Bu gorev departman havuzundan sahiplenilemez.")
            ]);
        }

        task.AssignedUserId = actor.UserId;
        task.CurrentStatus = WorkflowTaskStatus.Assigned;
        task.UpdatedByUserId = actor.UserId;
        task.UpdatedAtUtc = DateTimeOffset.UtcNow;

        _dbContext.AssignmentHistories.Add(new AssignmentHistory
        {
            AssignmentId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            TaskId = task.TaskId,
            FromDepartmentId = task.AssignedDepartmentId,
            ToDepartmentId = task.AssignedDepartmentId,
            FromUserId = null,
            ToUserId = actor.UserId,
            ActionType = "Claim",
            CreatedByUserId = actor.UserId
        });

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId.Value,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskClaimedFromPool",
            ActorUserId = actor.UserId
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
