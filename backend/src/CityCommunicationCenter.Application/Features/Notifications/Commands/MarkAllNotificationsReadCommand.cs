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

        return await _dbContext.Notifications
            .Where(entity =>
                entity.TenantId == tenantId
                && entity.UserId == userId
                && !entity.IsRead)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(entity => entity.IsRead, true)
                    .SetProperty(entity => entity.DeliveryStatus, NotificationDeliveryStatus.Read),
                cancellationToken);
    }
}
