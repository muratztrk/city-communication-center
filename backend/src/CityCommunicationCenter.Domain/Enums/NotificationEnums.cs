namespace CityCommunicationCenter.Domain.Enums;

public enum NotificationChannel
{
    InApp,
    Email,
    Sms,
    WebPush
}

public enum NotificationDeliveryStatus
{
    Pending,
    Sent,
    Failed,
    Read
}
