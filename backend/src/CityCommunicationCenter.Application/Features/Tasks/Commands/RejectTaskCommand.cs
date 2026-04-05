using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record RejectTaskCommand(Guid TaskId, Guid? ActorUserId, string? Comment) : ICommand<bool>;

public sealed class RejectTaskCommandHandler : IRequestHandler<RejectTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public RejectTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(RejectTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == request.TaskId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        if (task.CurrentStatus != WorkflowTaskStatus.PendingApproval)
        {
            throw CreateValidationException(nameof(request.TaskId), "Sadece onay bekleyen gorevler reddedilebilir.");
        }

        await TaskWorkflowAuthorization.EnsureCanApproveOrRejectAsync(
            _dbContext,
            task,
            request.ActorUserId,
            cancellationToken);

        task.CurrentStatus = WorkflowTaskStatus.Rejected;
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
            Decision = ApprovalDecision.Rejected,
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
            Action = "TaskRejected",
            ActorUserId = request.ActorUserId,
            Details = request.Comment
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static ValidationException CreateValidationException(string propertyName, string message)
    {
        return new ValidationException([
            new FluentValidation.Results.ValidationFailure(propertyName, message)
        ]);
    }
}