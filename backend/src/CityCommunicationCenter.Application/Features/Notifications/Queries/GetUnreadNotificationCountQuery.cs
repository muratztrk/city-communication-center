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

        // 1) Tek tek okunabilen gerçek bildirimler.
        var realUnread = await _dbContext.Notifications
            .CountAsync(
                entity =>
                    entity.TenantId == tenantId
                    && entity.UserId == request.UserId
                    && !entity.IsRead,
                cancellationToken);

        // 2) Talep/görev süreçlerindeki değişiklikler (AuditLog) de ilgili tüm kullanıcıların rozetinde
        //    uyarı vermeli (card 634): imleçten (NotificationReadCursor) sonraki ve kullanıcının kendi
        //    yapmadığı olaylar sayılır. Bunlar tek tek okunamaz; "Hepsini okundu yap" imleci ilerletir,
        //    böylece tek satıra tıklayınca sayının birden çok azalması sorunu da oluşmaz.
        var entityIds = await NotificationAudience.GetVisibleEntityIdsAsync(
            _dbContext, tenantId, request.UserId, cancellationToken);
        if (entityIds.Count == 0)
        {
            return realUnread;
        }

        var readThroughUtc = await _dbContext.NotificationReadCursors
            .AsNoTracking()
            .Where(cursor => cursor.TenantId == tenantId && cursor.UserId == request.UserId)
            .Select(cursor => (DateTimeOffset?)cursor.ReadThroughUtc)
            .FirstOrDefaultAsync(cancellationToken) ?? DateTimeOffset.MinValue;

        var historicalUnread = await _dbContext.AuditLogs
            .AsNoTracking()
            .CountAsync(
                auditLog =>
                    auditLog.TenantId == tenantId
                    && entityIds.Contains(auditLog.EntityId)
                    && auditLog.EventTimeUtc > readThroughUtc
                    && auditLog.ActorUserId != request.UserId,
                cancellationToken);

        return realUnread + historicalUnread;
    }
}
