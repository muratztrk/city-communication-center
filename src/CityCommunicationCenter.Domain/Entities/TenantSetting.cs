using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class TenantSetting : AuditableTenantEntity
{
    public Guid TenantSettingId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string? Theme { get; set; }

    public string? Domain { get; set; }

    public int DefaultSlaHours { get; set; } = 48;

    public bool AutoRoutingEnabled { get; set; } = false;
}
