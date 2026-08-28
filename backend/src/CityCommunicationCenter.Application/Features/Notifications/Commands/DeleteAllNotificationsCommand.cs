namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record DeleteAllNotificationsCommand() : ICommand<int>;

public sealed class DeleteAllNotificationsCommandHandler
    : ICommandHandler<DeleteAllNotificationsCommand, int>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteAllNotificationsCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<int> Handle(
        DeleteAllNotificationsCommand request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId
            ?? throw new UnauthorizedAccessException("Kullanıcı bağlamı gereklidir.");

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

        var dismissedAt = DateTimeOffset.UtcNow;
        var entityIds = await NotificationAudience.GetVisibleEntityIdsAsync(
            _dbContext, tenantId, userId, context.ActiveDepartmentId, cancellationToken);
        if (entityIds.Count > 0)
        {
            var latestAuditTime = await _dbContext.AuditLogs
                .Where(auditLog => auditLog.TenantId == tenantId && entityIds.Contains(auditLog.EntityId))
                .MaxAsync(auditLog => (DateTimeOffset?)auditLog.EventTimeUtc, cancellationToken);
            if (latestAuditTime.HasValue && latestAuditTime.Value > dismissedAt)
            {
                dismissedAt = latestAuditTime.Value;
            }
        }

        var latestNotificationTime = await _dbContext.Notifications
            .Where(entity => entity.TenantId == tenantId && entity.UserId == userId)
            .Select(entity => (DateTimeOffset?)(entity.SentAtUtc ?? entity.CreatedAtUtc))
            .MaxAsync(cancellationToken);
        if (latestNotificationTime.HasValue && latestNotificationTime.Value > dismissedAt)
        {
            dismissedAt = latestNotificationTime.Value;
        }

        var cursor = await NotificationAudience.GetOrCreateCursorAsync(
            _dbContext, tenantId, userId, cancellationToken);
        cursor.DismissedThroughUtc = dismissedAt;
        if (cursor.ReadThroughUtc < dismissedAt)
        {
            cursor.ReadThroughUtc = dismissedAt;
        }

        cursor.UpdatedByUserId = userId;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return updatedNotificationCount + 1;
    }
}
