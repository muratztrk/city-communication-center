namespace CityCommunicationCenter.Domain.Entities;

public sealed class CitizenConversation : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid CitizenConversationId { get; set; }

    /// <summary>Normalized WhatsApp phone number (E.164, e.g. 905301234567)</summary>
    public string CitizenPhone { get; set; } = string.Empty;

    public string? CitizenName { get; set; }

    public DateTimeOffset LastMessageAt { get; set; }

    public int UnreadCount { get; set; }

    /// <summary>Citizen sent STOP/DUR — do not send outbound messages</summary>
    public bool IsBlocked { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public ICollection<SocialMessage> SocialMessages { get; set; } = [];

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(
            [nameof(TenantId), nameof(CitizenPhone)],
            databaseName: "ix_citizenconversations_tenant_phone_unique"),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(LastMessageAt)),
    ];
}
