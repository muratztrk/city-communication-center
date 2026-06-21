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
        // Rozet yalnızca tek tek okundu olarak işaretlenebilen gerçek bildirimleri sayar.
        // AuditLog tabanlı geçmiş satırları NotificationReadCursor ile topluca okunur; onları
        // bu sayaca katmak, tek satıra tıklayınca sayının birden çok azalmasına yol açıyordu.
        return await _dbContext.Notifications
            .CountAsync(
                entity =>
                    entity.TenantId == tenantId
                    && entity.UserId == request.UserId
                    && !entity.IsRead,
                cancellationToken);
    }
}
