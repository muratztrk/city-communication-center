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

    public bool TimedReplyEnabled { get; set; }

    /// <summary>Local date in yyyy-MM-dd format.</summary>
    public string? TimedReplyStartDate { get; set; }

    /// <summary>Local date in yyyy-MM-dd format.</summary>
    public string? TimedReplyEndDate { get; set; }

    /// <summary>Local time in HH:mm format.</summary>
    public string? TimedReplyStartTime { get; set; }

    /// <summary>Local time in HH:mm format.</summary>
    public string? TimedReplyEndTime { get; set; }

    /// <summary>JSON-serialized string[] of weekday ids (monday..sunday).</summary>
    public string ActiveDaysJson { get; set; } = "[\"monday\",\"tuesday\",\"wednesday\",\"thursday\",\"friday\",\"saturday\",\"sunday\"]";

    /// <summary>When enabled, Saturday and Sunday are active for all hours regardless of start/end time.</summary>
    public bool TimedReplyWeekendAllHours { get; set; }

    /// <summary>Meta Graph language code (e.g. tr, en_US) when channel is WhatsApp Meta.</summary>
    public string? MetaLanguageCode { get; set; }

    /// <summary>Meta message template id from Graph API.</summary>
    public string? MetaExternalId { get; set; }

    /// <summary>Meta approval status (APPROVED, …).</summary>
    public string? MetaStatus { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Channel), nameof(IsActive)),
    ];
}
