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
    string Message,
    DateTimeOffset? SentAtUtc);
