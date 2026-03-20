
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record CloseTaskCommand(Guid TaskId, Guid? ActorUserId, string? ClosureNote) : ICommand<bool>;

public sealed class CloseTaskCommandHandler : IRequestHandler<CloseTaskCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public CloseTaskCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(CloseTaskCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == request.TaskId, cancellationToken);
        if (task is null)
        {
            return false;
        }

        var utcNow = DateTimeOffset.UtcNow;
        task.CurrentStatus = WorkflowTaskStatus.Closed;
        task.ClosedAtUtc = utcNow;
        task.UpdatedAtUtc = utcNow;
        task.UpdatedByUserId = request.ActorUserId;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = context.TenantId!.Value,
            EntityType = nameof(WorkTask),
            EntityId = request.TaskId.ToString(),
            Action = "TaskClosed",
            ActorUserId = request.ActorUserId,
            Details = request.ClosureNote
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}