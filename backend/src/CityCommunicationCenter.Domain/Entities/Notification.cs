using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class Notification : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid NotificationId { get; set; }

    public Guid? TaskId { get; set; }

    public Guid UserId { get; set; }

    public NotificationChannel Channel { get; set; } = NotificationChannel.InApp;

    public NotificationDeliveryStatus DeliveryStatus { get; set; } = NotificationDeliveryStatus.Pending;

    public string Message { get; set; } = string.Empty;

    public DateTimeOffset? SentAtUtc { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(UserId), nameof(DeliveryStatus)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(TaskId)),
    ];
}
