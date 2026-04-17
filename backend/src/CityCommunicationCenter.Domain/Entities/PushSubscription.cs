using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class PushSubscription : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid PushSubscriptionId { get; set; }

    public Guid UserId { get; set; }

    public string Endpoint { get; set; } = string.Empty;

    public string P256dhKey { get; set; } = string.Empty;

    public string AuthKey { get; set; } = string.Empty;

    public string? UserAgent { get; set; }

    public bool IsActive { get; set; } = true;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(UserId)),
        DatabaseIndexDefinition.Unique([nameof(Endpoint)], databaseName: "ix_pushsubscriptions_endpoint_unique"),
    ];
}
