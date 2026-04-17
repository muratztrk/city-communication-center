namespace CityCommunicationCenter.Application.Abstractions;

public interface INotificationPushService
{
    Task SendToUserAsync(Guid tenantId, Guid userId, NotificationPayload payload, CancellationToken cancellationToken = default);
    Task SendToTenantAsync(Guid tenantId, NotificationPayload payload, CancellationToken cancellationToken = default);
}

public sealed record NotificationPayload(
    Guid NotificationId,
    string Title,
    string Message,
    string? ActionUrl = null);
