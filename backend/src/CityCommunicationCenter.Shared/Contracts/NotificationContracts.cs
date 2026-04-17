namespace CityCommunicationCenter.Shared.Contracts;

public sealed record TestNotificationRequest(
    string Channel,
    string Recipient,
    string Message);

public sealed record UpdateNotificationPreferencesRequest(
    bool EmailEnabled,
    bool SmsEnabled,
    bool InAppEnabled);

public sealed record NotificationResponse(
    Guid NotificationId,
    Guid? TaskId,
    Guid UserId,
    string Channel,
    string DeliveryStatus,
    string Title,
    string Message,
    bool IsRead,
    string? ActionUrl,
    DateTimeOffset? SentAtUtc);

public sealed record TestNotificationResponse(
    Guid NotificationId,
    string Recipient);

public sealed record PushSubscriptionRequest(
    string Endpoint,
    string P256dhKey,
    string AuthKey,
    string? UserAgent);

public sealed record PushUnsubscribeRequest(string Endpoint);
