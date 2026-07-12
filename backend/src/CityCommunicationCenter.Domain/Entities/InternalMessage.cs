namespace CityCommunicationCenter.Domain.Entities;

// Kurum içi konuşmadaki tek bir mesaj (card #1539). ReadAtUtc, alıcının (gönderen olmayan taraf)
// mesajı okuduğu an yazılır — 1'e-1 konuşmada alıcı tekildir.
public sealed class InternalMessage : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid InternalMessageId { get; set; }

    public Guid InternalConversationId { get; set; }

    public Guid SenderUserId { get; set; }

    public string Content { get; set; } = string.Empty;

    public DateTimeOffset? ReadAtUtc { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(InternalConversationId)),
    ];
}
