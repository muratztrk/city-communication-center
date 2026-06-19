using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record ClaimTaskFromPoolCommand(Guid TaskId, Guid? ActorUserId) : ICommand<bool>;

public sealed class ClaimTaskFromPoolCommandHandler : ICommandHandler<ClaimTaskFromPoolCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ClaimTaskFromPoolCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(ClaimTaskFromPoolCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        var actor = await TaskWorkflowAuthorization.EnsureCanClaimFromPoolAsync(_dbContext, task, request.ActorUserId, tenantId, cancellationToken);
        if (!TaskWorkflowAuthorization.IsClaimableFromDepartmentPool(task))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Bu gorev departman havuzundan sahiplenilemez.")
            ]);
        }

        task.AssignedUserId = actor.UserId;
        task.AssignedAtUtc = DateTimeOffset.UtcNow;   // Havuzdan üstlenildi → atanma anı (card 589).
        task.CurrentStatus = WorkflowTaskStatus.Assigned;
        task.UpdatedByUserId = actor.UserId;
        task.UpdatedAtUtc = DateTimeOffset.UtcNow;

        _dbContext.AssignmentHistories.Add(new AssignmentHistory
        {
            AssignmentId = Guid.NewGuid(),
            TenantId = tenantId,
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
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskClaimedFromPool",
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = WorkflowTaskStatus.Assigned.ToString()
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
