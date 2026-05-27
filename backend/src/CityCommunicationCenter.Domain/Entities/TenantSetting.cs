namespace CityCommunicationCenter.Domain.Entities;

public sealed class TenantSetting : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid TenantSettingId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string? Theme { get; set; }

    public string? Domain { get; set; }

    public int DefaultSlaHours { get; set; } = 48;

    public bool AutoRoutingEnabled { get; set; } = false;

    public string? SocialSettingsJson { get; set; }

    public string? LdapSettingsJson { get; set; }

    public string? AuthPolicyJson { get; set; }

    public string? AppearanceJson { get; set; }

    public string? WorkingHoursJson { get; set; }

    public string? SmsSettingsJson { get; set; }

    public string? RolePageAccessJson { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(nameof(TenantId), databaseName: "ix_tenantsettings_tenantid_unique"),
    ];
}
