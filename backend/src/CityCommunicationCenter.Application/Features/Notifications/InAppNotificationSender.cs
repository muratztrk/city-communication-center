using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Notifications;

internal static class InAppNotificationSender
{
    public static async Task SendAsync(
        IApplicationDbContext dbContext,
        INotificationPushService pushService,
        Guid tenantId,
        Guid recipientUserId,
        string title,
        string message,
        Guid? taskId,
        string? actionUrl,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (recipientUserId == Guid.Empty)
        {
            return;
        }

        var utcNow = DateTimeOffset.UtcNow;
        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = recipientUserId,
            TaskId = taskId,
            Title = title,
            Message = message,
            ActionUrl = actionUrl,
            Channel = NotificationChannel.InApp,
            DeliveryStatus = NotificationDeliveryStatus.Sent,
            SentAtUtc = utcNow,
            CreatedByUserId = actorUserId,
        };

        dbContext.Notifications.Add(notification);
        await dbContext.SaveChangesAsync(cancellationToken);

        await pushService.SendToUserAsync(
            tenantId,
            recipientUserId,
            new NotificationPayload(notification.NotificationId, title, message, actionUrl),
            cancellationToken);
    }
}
