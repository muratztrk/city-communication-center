using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class MailOutboundLog : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid MailOutboundLogId { get; set; }

    public MailOutboundKind Kind { get; set; } = MailOutboundKind.Unknown;

    public string RecipientEmail { get; set; } = string.Empty;

    public Guid? RecipientUserId { get; set; }

    public Guid? JobId { get; set; }

    public Guid? TaskId { get; set; }

    public string? RequestNumber { get; set; }

    public string? Subject { get; set; }

    public bool Success { get; set; }

    public string? ErrorMessage { get; set; }

    public int TextLength { get; set; }

    public string? BodyPreview { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(CreatedAtUtc)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Kind), nameof(CreatedAtUtc)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(JobId)),
    ];
}
