using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record SubmitTaskCommand(Guid TaskId, Guid? ActorUserId, string? Note) : ICommand<bool>;

public sealed class SubmitTaskCommandHandler : IRequestHandler<SubmitTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SubmitTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(SubmitTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == request.TaskId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        Department? targetDepartment = null;
        if (task.TargetDepartmentId.HasValue)
        {
            targetDepartment = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == task.TargetDepartmentId.Value, cancellationToken);
        }

        if (task.TargetDepartmentId.HasValue && targetDepartment?.ManagerUserId is null)
        {
            task.AssignedDepartmentId = task.TargetDepartmentId;
            task.CurrentStatus = WorkflowTaskStatus.Assigned;
        }
        else
        {
            task.CurrentStatus = WorkflowTaskStatus.PendingApproval;
        }

        task.UpdatedByUserId = request.ActorUserId;
        task.UpdatedAtUtc = DateTimeOffset.UtcNow;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            EntityType = nameof(WorkTask),
            EntityId = request.TaskId.ToString(),
            Action = "TaskSubmitted",
            ActorUserId = request.ActorUserId,
            Details = request.Note
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}