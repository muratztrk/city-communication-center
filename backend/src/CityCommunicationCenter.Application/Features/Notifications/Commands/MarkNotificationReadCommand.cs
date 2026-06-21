namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record MarkNotificationReadCommand(Guid NotificationId) : ICommand<bool>;

public sealed class MarkNotificationReadCommandHandler : ICommandHandler<MarkNotificationReadCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public MarkNotificationReadCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId
            ?? throw new UnauthorizedAccessException("User context is required.");
        var notification = await _dbContext.Notifications
            .FirstOrDefaultAsync(
                entity =>
                    entity.NotificationId == request.NotificationId
                    && entity.TenantId == tenantId
                    && entity.UserId == userId,
                cancellationToken);

        if (notification is not null)
        {
            notification.IsRead = true;
            notification.DeliveryStatus = NotificationDeliveryStatus.Read;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        var entityIds = await NotificationAudience.GetVisibleEntityIdsAsync(
            _dbContext, tenantId, userId, cancellationToken);
        var auditLog = await _dbContext.AuditLogs
            .AsNoTracking()
            .SingleOrDefaultAsync(
                entity =>
                    entity.AuditLogId == request.NotificationId
                    && entity.TenantId == tenantId
                    && entityIds.Contains(entity.EntityId),
                cancellationToken);
        if (auditLog is null)
        {
            return false;
        }

        // Geçmiş (AuditLog) bildirimini TEKİL olarak okundu işaretle; imleci ilerletme — yoksa bu
        // olaydan daha eski tüm olaylar da okunmuş sayılır ve rozet tek tıkla birden çok azalır (card 633).
        // "Hepsini okundu yap" hâlâ imleci ilerletir (MarkAllNotificationsReadCommand).
        var alreadyRead = await _dbContext.NotificationAuditReads
            .AnyAsync(
                entry =>
                    entry.TenantId == tenantId
                    && entry.UserId == userId
                    && entry.AuditLogId == auditLog.AuditLogId,
                cancellationToken);
        if (!alreadyRead)
        {
            _dbContext.NotificationAuditReads.Add(new NotificationAuditRead
            {
                NotificationAuditReadId = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                AuditLogId = auditLog.AuditLogId,
                CreatedByUserId = userId,
            });
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return true;
    }
}
