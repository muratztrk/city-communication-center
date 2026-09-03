using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class SupportRequest : AuditableTenantEntity
{
    public Guid SupportRequestId { get; set; }

    public string Subject { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    /// <summary>İsteğin gönderildiği ekran (frontend route) — Lumespec tarafının bağlamı anlaması için.</summary>
    public string? PageContext { get; set; }
}
