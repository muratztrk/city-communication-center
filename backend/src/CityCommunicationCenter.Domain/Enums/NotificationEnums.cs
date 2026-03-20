namespace CityCommunicationCenter.Domain.Enums;

public enum NotificationChannel
{
    InApp,
    Email,
    Sms
}

public enum NotificationDeliveryStatus
{
    Pending,
    Sent,
    Failed
}
