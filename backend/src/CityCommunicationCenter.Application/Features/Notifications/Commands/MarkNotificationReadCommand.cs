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
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var notification = await _dbContext.Notifications
            .FirstOrDefaultAsync(
                entity => entity.NotificationId == request.NotificationId && entity.TenantId == tenantId,
                cancellationToken);

        if (notification is null) return false;

        notification.IsRead = true;
        notification.DeliveryStatus = NotificationDeliveryStatus.Read;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
