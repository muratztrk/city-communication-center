using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class SupportRequest : AuditableTenantEntity
{
    public Guid SupportRequestId { get; set; }

    public string Subject { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    /// <summary>İsteğin gönderildiği ekran (frontend route) — Lumespec tarafının bağlamı anlaması için.</summary>
    public string? PageContext { get; set; }

    public string? CentralTicketNo { get; set; }

    public string? CentralStatus { get; set; }

    public DateTimeOffset? CentralSyncedAtUtc { get; set; }

    /// <summary>Kullanıcı Çözümü Onayla dediğinde yazılır.</summary>
    public DateTimeOffset? ResolvedAtUtc { get; set; }

    public string? CentralSyncError { get; set; }

    /// <summary>Lumespec yazışmasının son başarılı kopyası. Canlı çağrı düşerse detay bunu gösterir.</summary>
    public string? CentralThreadJson { get; set; }

    /// <summary>Lumespec destek önceliği (UI; varsayılan Normal).</summary>
    public string Priority { get; set; } = "Normal";
}
