using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record UpdateTaskDueDateCommand(Guid TaskId, Guid? ActorUserId, DateTimeOffset? DueDateUtc) : ICommand<bool>;

public sealed class UpdateTaskDueDateCommandHandler : ICommandHandler<UpdateTaskDueDateCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTaskDueDateCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateTaskDueDateCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(
            entity => entity.TaskId == request.TaskId && entity.TenantId == tenantId,
            cancellationToken);
        if (task is null) return false;

        var job = await _dbContext.Jobs.FirstOrDefaultAsync(
            entity => entity.JobId == task.JobId && entity.TenantId == tenantId,
            cancellationToken);
        if (job is null) return false;

        await TaskWorkflowAuthorization.EnsureCanApproveTaskCloseAsync(
            _dbContext,
            task,
            job,
            request.ActorUserId,
            tenantId,
            cancellationToken);

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Tamamlanmis/iptal edilmis gorevlerin son tarihi guncellenemez.")
            ]);
        }

        var utcNow = DateTimeOffset.UtcNow;
        task.DueDateUtc = request.DueDateUtc;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskDueDateUpdated",
            ActorUserId = request.ActorUserId,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = request.DueDateUtc?.ToString("O"),
            Details = request.DueDateUtc?.ToString("O")
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
