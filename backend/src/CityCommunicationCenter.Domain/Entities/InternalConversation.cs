namespace CityCommunicationCenter.Domain.Entities;

// Sistemdeki iki kullanıcı arasındaki kurum içi (personel-arası) mesajlaşma konuşması (card #1539).
// UserAId her zaman UserBId'den küçük Guid'dir — çift için tek satır garantisi (bkz. CreateInternalConversationCommand).
public sealed class InternalConversation : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid InternalConversationId { get; set; }

    public Guid UserAId { get; set; }

    public Guid UserBId { get; set; }

    public DateTimeOffset LastMessageAtUtc { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique([nameof(TenantId), nameof(UserAId), nameof(UserBId)]),
    ];
}
