namespace CityCommunicationCenter.Application.Features.Notifications;

public sealed record MarkNotificationReadCommand(Guid NotificationId) : ICommand<bool>;

public sealed class MarkNotificationReadCommandHandler : IRequestHandler<MarkNotificationReadCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public MarkNotificationReadCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
    {
        var notification = await _dbContext.Notifications
            .FirstOrDefaultAsync(entity => entity.NotificationId == request.NotificationId, cancellationToken);

        if (notification is null) return false;

        notification.IsRead = true;
        notification.DeliveryStatus = NotificationDeliveryStatus.Read;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
