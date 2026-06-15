namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record MarkAllNotificationsReadCommand() : ICommand<int>;

public sealed class MarkAllNotificationsReadCommandHandler
    : ICommandHandler<MarkAllNotificationsReadCommand, int>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public MarkAllNotificationsReadCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<int> Handle(
        MarkAllNotificationsReadCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId
            ?? throw new UnauthorizedAccessException("User context is required.");

        var updatedNotificationCount = await _dbContext.Notifications
            .Where(entity =>
                entity.TenantId == tenantId
                && entity.UserId == userId
                && !entity.IsRead)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(entity => entity.IsRead, true)
                    .SetProperty(entity => entity.DeliveryStatus, NotificationDeliveryStatus.Read),
                cancellationToken);

        var entityIds = await NotificationAudience.GetVisibleEntityIdsAsync(
            _dbContext, tenantId, userId, cancellationToken);
        if (entityIds.Count == 0)
        {
            return updatedNotificationCount;
        }

        var latestAuditTime = await _dbContext.AuditLogs
            .Where(auditLog => auditLog.TenantId == tenantId && entityIds.Contains(auditLog.EntityId))
            .MaxAsync(auditLog => (DateTimeOffset?)auditLog.EventTimeUtc, cancellationToken);
        if (!latestAuditTime.HasValue)
        {
            return updatedNotificationCount;
        }

        var cursor = await NotificationAudience.GetOrCreateCursorAsync(
            _dbContext, tenantId, userId, cancellationToken);
        cursor.ReadThroughUtc = latestAuditTime.Value;
        cursor.UpdatedByUserId = userId;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return updatedNotificationCount + 1;
    }
}
