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

        var cursorTimes = await _dbContext.NotificationReadCursors
            .AsNoTracking()
            .Where(cursor => cursor.TenantId == tenantId && cursor.UserId == request.UserId)
            .Select(cursor => new { cursor.ReadThroughUtc, cursor.DismissedThroughUtc })
            .FirstOrDefaultAsync(cancellationToken);
        var readThroughUtc = cursorTimes?.ReadThroughUtc ?? DateTimeOffset.MinValue;
        var dismissedThroughUtc = cursorTimes?.DismissedThroughUtc ?? DateTimeOffset.MinValue;

        // 1) Tek tek okunabilen gerçek bildirimler.
        var realUnread = await _dbContext.Notifications
            .CountAsync(
                entity =>
                    entity.TenantId == tenantId
                    && entity.UserId == request.UserId
                    && !entity.IsRead
                    && (entity.SentAtUtc ?? entity.CreatedAtUtc) > dismissedThroughUtc,
                cancellationToken);

        // 2) Talep/görev süreçlerindeki değişiklikler (AuditLog) de ilgili tüm kullanıcıların rozetinde
        //    uyarı vermeli (card 634): imleçten (NotificationReadCursor) sonraki ve kullanıcının kendi
        //    yapmadığı olaylar sayılır. Bunlar tek tek okunamaz; "Hepsini okundu yap" imleci ilerletir,
        //    böylece tek satıra tıklayınca sayının birden çok azalması sorunu da oluşmaz.
        var activeDepartmentId = _tenantContextAccessor.GetCurrent().ActiveDepartmentId;
        var entityIds = await NotificationAudience.GetVisibleEntityIdsAsync(
            _dbContext, tenantId, request.UserId, activeDepartmentId, cancellationToken);
        if (entityIds.Count == 0)
        {
            return realUnread;
        }

        // Tek tek okunmuş (rozet tam 1 azalsın diye) geçmiş bildirimler sayım dışı (card 633).
        var readAuditIds = await _dbContext.NotificationAuditReads
            .AsNoTracking()
            .Where(entry => entry.TenantId == tenantId && entry.UserId == request.UserId)
            .Select(entry => entry.AuditLogId)
            .ToListAsync(cancellationToken);

        var historicalUnread = await _dbContext.AuditLogs
            .AsNoTracking()
            .CountAsync(
                auditLog =>
                    auditLog.TenantId == tenantId
                    && entityIds.Contains(auditLog.EntityId)
                    && auditLog.EventTimeUtc > readThroughUtc
                    && auditLog.EventTimeUtc > dismissedThroughUtc
                    && !readAuditIds.Contains(auditLog.AuditLogId)
                    && NotificationAuditRules.ShouldCountAuditAsUnread(auditLog, request.UserId),
                cancellationToken);

        return realUnread + historicalUnread;
    }
}
