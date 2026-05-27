using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record UpdateTaskProgressCommand(Guid TaskId, Guid? ActorUserId, int? CompletionPercentage, decimal? ActualHours, string? Notes) : ICommand<bool>;

public sealed class UpdateTaskProgressCommandHandler : ICommandHandler<UpdateTaskProgressCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTaskProgressCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(UpdateTaskProgressCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(e => e.TaskId == request.TaskId && e.TenantId == tenantId, cancellationToken);
        if (task is null) return false;

        await TaskWorkflowAuthorization.EnsureCanActAsAssigneeAsync(_dbContext, task, request.ActorUserId, tenantId, cancellationToken);

        if (task.CurrentStatus is WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.TaskId), "Tamamlanmis/iptal edilmis gorevler guncellenemez.")
            ]);
        }

        if (request.CompletionPercentage.HasValue)
        {
            var pct = Math.Clamp(request.CompletionPercentage.Value, 0, 100);
            task.CompletionPercentage = pct;
            if (task.CurrentStatus == WorkflowTaskStatus.Assigned && pct > 0)
            {
                task.CurrentStatus = WorkflowTaskStatus.InProgress;
            }
        }

        if (request.ActualHours.HasValue) task.ActualHours = request.ActualHours;
        if (!string.IsNullOrWhiteSpace(request.Notes)) task.Notes = request.Notes;

        task.UpdatedAtUtc = DateTimeOffset.UtcNow;
        task.UpdatedByUserId = request.ActorUserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskProgressUpdated",
            ActorUserId = request.ActorUserId,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = request.CompletionPercentage.HasValue ? $"{request.CompletionPercentage}%" : null,
            Details = request.CompletionPercentage?.ToString()
        });

        await TaskWorkflowAuthorization.RecomputeJobCompletionAsync(_dbContext, task.JobId, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
