namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record GetUnreadNotificationCountQuery(Guid UserId) : IQuery<int>;

public sealed class GetUnreadNotificationCountQueryHandler : IQueryHandler<GetUnreadNotificationCountQuery, int>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetUnreadNotificationCountQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<int> Handle(GetUnreadNotificationCountQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var notificationCount = await _dbContext.Notifications
            .CountAsync(
                entity =>
                    entity.TenantId == tenantId
                    && entity.UserId == request.UserId
                    && !entity.IsRead,
                cancellationToken);
        var entityIds = await NotificationAudience.GetVisibleEntityIdsAsync(
            _dbContext, tenantId, request.UserId, cancellationToken);
        if (entityIds.Count == 0)
        {
            return notificationCount;
        }

        var readThroughUtc = await _dbContext.NotificationReadCursors
            .AsNoTracking()
            .Where(cursor => cursor.TenantId == tenantId && cursor.UserId == request.UserId)
            .Select(cursor => (DateTimeOffset?)cursor.ReadThroughUtc)
            .SingleOrDefaultAsync(cancellationToken);
        var auditCount = readThroughUtc.HasValue
            ? await _dbContext.AuditLogs.CountAsync(
                auditLog =>
                    auditLog.TenantId == tenantId
                    && entityIds.Contains(auditLog.EntityId)
                    && auditLog.EventTimeUtc > readThroughUtc.Value,
                cancellationToken)
            : await _dbContext.AuditLogs.AnyAsync(
                auditLog =>
                    auditLog.TenantId == tenantId
                    && entityIds.Contains(auditLog.EntityId),
                cancellationToken)
                ? 1
                : 0;

        return notificationCount + auditCount;
    }
}
