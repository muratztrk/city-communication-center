using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class SmsOutboundLog : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid SmsOutboundLogId { get; set; }

    public SmsOutboundKind Kind { get; set; } = SmsOutboundKind.Unknown;

    public string RecipientPhoneMasked { get; set; } = string.Empty;

    public Guid? RecipientUserId { get; set; }

    public Guid? JobId { get; set; }

    public Guid? SocialMessageId { get; set; }

    public Guid? TaskId { get; set; }

    public string? RequestNumber { get; set; }

    public bool Success { get; set; }

    public string? Provider { get; set; }

    public string? ProviderCode { get; set; }

    public string? ProviderMessage { get; set; }

    public int TextLength { get; set; }

    public string? BodyPreview { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(CreatedAtUtc)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Kind), nameof(CreatedAtUtc)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(JobId)),
    ];
}
