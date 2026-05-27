namespace CityCommunicationCenter.Domain.Entities;

public sealed class AuditLog : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid AuditLogId { get; set; }

    public string EntityType { get; set; } = string.Empty;

    public string EntityId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public Guid? ActorUserId { get; set; }

    public DateTimeOffset EventTimeUtc { get; set; } = DateTimeOffset.UtcNow;

    public string? Details { get; set; }
    public string? ActorDisplayName { get; set; }
    public string? DepartmentName { get; set; }
    public string? StatusAtEvent { get; set; }
    public string? Notes { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(EntityType), nameof(EntityId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(EventTimeUtc)),
    ];
}
