namespace CityCommunicationCenter.Domain.Entities;

public sealed class NotificationReadCursor : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid NotificationReadCursorId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset ReadThroughUtc { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(
            [nameof(TenantId), nameof(UserId)],
            databaseName: "ix_notificationreadcursors_tenant_user_unique"),
    ];
}
