
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CompleteTaskCommand(Guid TaskId, Guid? ActorUserId, string? ResultNote) : ICommand<bool>;

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
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == request.TaskId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        var utcNow = DateTimeOffset.UtcNow;
        task.CurrentStatus = WorkflowTaskStatus.Completed;
        task.CompletedAtUtc = utcNow;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            EntityType = nameof(WorkTask),
            EntityId = request.TaskId.ToString(),
            Action = "TaskCompleted",
            ActorUserId = request.ActorUserId,
            Details = request.ResultNote
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}