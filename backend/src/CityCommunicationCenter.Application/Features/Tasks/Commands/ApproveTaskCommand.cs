using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record ApproveTaskCommand(Guid TaskId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class ApproveTaskCommandHandler : IRequestHandler<ApproveTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ApproveTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(ApproveTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == request.TaskId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        task.CurrentStatus = WorkflowTaskStatus.Assigned;
        task.UpdatedByUserId = request.ActorUserId;
        task.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var stepOrder = await _dbContext.Approvals.CountAsync(entity => entity.TaskId == request.TaskId, cancellationToken) + 1;
        _dbContext.Approvals.Add(new Approval
        {
            ApprovalId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            TaskId = request.TaskId,
            ApproverUserId = request.ActorUserId ?? Guid.Empty,
            StepOrder = stepOrder,
            Decision = ApprovalDecision.Approved,
            Comment = request.Comment,
            DecisionDateUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = request.ActorUserId
        });

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId.Value,
            EntityType = nameof(WorkTask),
            EntityId = request.TaskId.ToString(),
            Action = "TaskApproved",
            ActorUserId = request.ActorUserId,
            Details = request.Comment
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}