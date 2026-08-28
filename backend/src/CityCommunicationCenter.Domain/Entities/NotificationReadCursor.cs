namespace CityCommunicationCenter.Domain.Entities;

public sealed class NotificationReadCursor : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid NotificationReadCursorId { get; set; }

    public Guid UserId { get; set; }

    public DateTimeOffset ReadThroughUtc { get; set; }

    /// <summary>
    /// Bu andan önceki feed öğeleri "Tümünü sil" ile gizlenir; sonrakiler görünür kalır (#3109).
    /// </summary>
    public DateTimeOffset? DismissedThroughUtc { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(
            [nameof(TenantId), nameof(UserId)],
            databaseName: "ix_notificationreadcursors_tenant_user_unique"),
    ];
}
