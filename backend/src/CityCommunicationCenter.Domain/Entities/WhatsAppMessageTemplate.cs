namespace CityCommunicationCenter.Domain.Entities;

public sealed class WhatsAppMessageTemplate : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid TemplateId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    /// <summary>Channel filter: "Genel", "WhatsApp", "Facebook", etc.</summary>
    public string Channel { get; set; } = "Genel";

    public bool IsGeneral { get; set; }

    public bool AutoReply { get; set; }

    public int ReplyDelaySecs { get; set; } = 30;

    public bool HasKeyword { get; set; }

    public string QueryType { get; set; } = "(LIKE) İçerikte Geçsin";

    /// <summary>JSON-serialized string[] of trigger keywords.</summary>
    public string KeywordsJson { get; set; } = "[]";

    public Tenant Tenant { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Channel), nameof(IsActive)),
    ];
}
