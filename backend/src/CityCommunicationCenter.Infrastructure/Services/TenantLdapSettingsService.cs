using System.Security.Cryptography;
using System.Text.Json;
using CityCommunicationCenter.Infrastructure.Options;
using Microsoft.AspNetCore.DataProtection;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantLdapSettingsService : ITenantLdapSettingsService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IApplicationDbContext _dbContext;
    private readonly IDataProtector _dataProtector;
    private readonly AuthenticationOptions _options;

    public TenantLdapSettingsService(
        IApplicationDbContext dbContext,
        IDataProtectionProvider dataProtectionProvider,
        IOptions<AuthenticationOptions> options)
    {
        _dbContext = dbContext;
        _dataProtector = dataProtectionProvider.CreateProtector("CityCommunicationCenter.TenantLdapSettings.v1");
        _options = options.Value;
    }

    public async Task<TenantLdapSettingsDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var settings = await GetRuntimeSettingsAsync(tenantId, cancellationToken);

        return new TenantLdapSettingsDescriptor(
            settings.Enabled,
            settings.AutoProvisionUsers,
            settings.Host,
            settings.Port,
            settings.UseSsl,
            settings.IgnoreCertificateErrors,
            settings.Domain,
            settings.SearchBase,
            settings.BindDn,
            !string.IsNullOrWhiteSpace(settings.BindPassword),
            settings.UserAttribute,
            settings.CanAuthenticate,
            settings.CanSearch);
    }

    public async Task<TenantLdapRuntimeSettings> GetRuntimeSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var payload = await GetPayloadAsync(tenantId, cancellationToken);
        return BuildRuntimeSettings(payload);
    }

    public async Task SaveSettingsAsync(Guid tenantId, TenantLdapSettingsUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var currentPayload = await GetPayloadAsync(tenantId, cancellationToken);
        var bindPassword = settings.ClearBindPassword
            ? null
            : string.IsNullOrWhiteSpace(settings.BindPassword)
                ? currentPayload.BindPassword
                : settings.BindPassword;

        var payload = new TenantLdapSettingsPayload
        {
            Enabled = settings.Enabled,
            AutoProvisionUsers = settings.AutoProvisionUsers,
            Host = Normalize(settings.Host),
            Port = settings.Port > 0 ? settings.Port : Math.Max(_options.Ldap.Port, 389),
            UseSsl = settings.UseSsl,
            IgnoreCertificateErrors = settings.IgnoreCertificateErrors,
            Domain = Normalize(settings.Domain),
            SearchBase = Normalize(settings.SearchBase),
            BindDn = Normalize(settings.BindDn),
            BindPassword = bindPassword,
            UserAttribute = Normalize(settings.UserAttribute) ?? _options.Ldap.UserAttribute,
        };

        var serializedPayload = _dataProtector.Protect(JsonSerializer.Serialize(payload, SerializerOptions));
        var tenantSetting = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        if (tenantSetting is null)
        {
            _dbContext.TenantSettings.Add(new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
                DisplayName = string.Empty,
                DefaultSlaHours = 48,
                AutoRoutingEnabled = false,
                LdapSettingsJson = serializedPayload,
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.LdapSettingsJson = serializedPayload;
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<TenantLdapSettingsPayload> GetPayloadAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var payload = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.LdapSettingsJson)
            .SingleOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(payload))
        {
            return new TenantLdapSettingsPayload
            {
                Port = Math.Max(_options.Ldap.Port, 389),
                UserAttribute = _options.Ldap.UserAttribute,
            };
        }

        try
        {
            payload = _dataProtector.Unprotect(payload);
        }
        catch (CryptographicException)
        {
            // Backward compatibility for plaintext seed/default payloads.
        }

        return JsonSerializer.Deserialize<TenantLdapSettingsPayload>(payload, SerializerOptions)
            ?? new TenantLdapSettingsPayload
            {
                Port = Math.Max(_options.Ldap.Port, 389),
                UserAttribute = _options.Ldap.UserAttribute,
            };
    }

    private TenantLdapRuntimeSettings BuildRuntimeSettings(TenantLdapSettingsPayload payload)
    {
        var mockUsers = _options.Ldap.MockUsers
            .Select(candidate => new LdapDirectoryCredential(
                candidate.ExternalIdentityId,
                candidate.Username,
                candidate.DisplayName,
                candidate.Email,
                candidate.Password))
            .ToArray();

        var enabled = payload.Enabled;
        var host = Normalize(payload.Host);
        var bindDn = Normalize(payload.BindDn);
        var bindPassword = NormalizeSecret(payload.BindPassword);
        var searchBase = Normalize(payload.SearchBase);
        var canAuthenticate = enabled && (!string.IsNullOrWhiteSpace(host) || mockUsers.Length > 0);
        var canSearch = enabled && (mockUsers.Length > 0 || (!string.IsNullOrWhiteSpace(host) && !string.IsNullOrWhiteSpace(searchBase) && !string.IsNullOrWhiteSpace(bindDn) && !string.IsNullOrWhiteSpace(bindPassword)));

        return new TenantLdapRuntimeSettings(
            enabled,
            payload.AutoProvisionUsers,
            host,
            payload.Port > 0 ? payload.Port : Math.Max(_options.Ldap.Port, 389),
            payload.UseSsl,
            payload.IgnoreCertificateErrors,
            Normalize(payload.Domain),
            searchBase,
            bindDn,
            bindPassword,
            Normalize(payload.UserAttribute) ?? _options.Ldap.UserAttribute,
            canAuthenticate,
            canSearch,
            mockUsers);
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? NormalizeSecret(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    private sealed class TenantLdapSettingsPayload
    {
        public bool Enabled { get; set; }

        public bool AutoProvisionUsers { get; set; }

        public string? Host { get; set; }

        public int Port { get; set; } = 389;

        public bool UseSsl { get; set; }

        public bool IgnoreCertificateErrors { get; set; }

        public string? Domain { get; set; }

        public string? SearchBase { get; set; }

        public string? BindDn { get; set; }

        public string? BindPassword { get; set; }

        public string UserAttribute { get; set; } = "mail";
    }
}