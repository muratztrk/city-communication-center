using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantSmsSettingsService : ITenantSmsSettingsService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IApplicationDbContext _dbContext;
    private readonly IDataProtector _dataProtector;

    public TenantSmsSettingsService(
        IApplicationDbContext dbContext,
        IDataProtectionProvider dataProtectionProvider)
    {
        _dbContext = dbContext;
        _dataProtector = dataProtectionProvider.CreateProtector("CityCommunicationCenter.TenantSmsSettings.v1");
    }

    public async Task<TenantSmsSettingsDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var payload = await GetPayloadAsync(tenantId, cancellationToken);

        return new TenantSmsSettingsDescriptor(
            payload.IsEnabled,
            payload.LiveSendEnabled,
            ParseProvider(payload.Provider),
            payload.ApiUrl,
            payload.Username,
            !string.IsNullOrWhiteSpace(payload.Password),
            payload.Originator,
            payload.ChargedNumber);
    }

    public async Task<TenantSmsCredentials> GetCredentialsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var payload = await GetPayloadAsync(tenantId, cancellationToken);

        return new TenantSmsCredentials(
            payload.IsEnabled,
            payload.LiveSendEnabled,
            ParseProvider(payload.Provider),
            payload.ApiUrl,
            payload.Username,
            payload.Password,
            payload.Originator,
            payload.ChargedNumber);
    }

    private static SmsProvider ParseProvider(string? value) =>
        Enum.TryParse<SmsProvider>(value, out var provider) ? provider : SmsProvider.NetGSM;

    public async Task SaveSettingsAsync(Guid tenantId, TenantSmsSettingsUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var currentPayload = await GetPayloadAsync(tenantId, cancellationToken);
        var password = settings.ClearPassword
            ? null
            : string.IsNullOrWhiteSpace(settings.Password)
                ? currentPayload.Password
                : settings.Password;

        var payload = new TenantSmsSettingsPayload
        {
            IsEnabled = settings.IsEnabled,
            LiveSendEnabled = settings.LiveSendEnabled,
            Provider = settings.Provider.ToString(),
            ApiUrl = Normalize(settings.ApiUrl),
            Username = Normalize(settings.Username),
            Password = password,
            Originator = Normalize(settings.Originator),
            ChargedNumber = Normalize(settings.ChargedNumber),
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
                SmsSettingsJson = serializedPayload,
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.SmsSettingsJson = serializedPayload;
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<TenantSmsSettingsPayload> GetPayloadAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var raw = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.SmsSettingsJson)
            .SingleOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(raw))
        {
            return new TenantSmsSettingsPayload();
        }

        try
        {
            raw = _dataProtector.Unprotect(raw);
        }
        catch (CryptographicException)
        {
            // Backward compatibility for plaintext seed/default payloads.
        }

        return JsonSerializer.Deserialize<TenantSmsSettingsPayload>(raw, SerializerOptions)
            ?? new TenantSmsSettingsPayload();
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private sealed class TenantSmsSettingsPayload
    {
        public bool IsEnabled { get; set; }

        /// <summary>
        /// Varsayılan <c>false</c> = simülasyon. Mevcut kayıtlarda bu alan yok; JSON'dan
        /// okunurken false gelir, yani entegrasyon canlıya alınmadan önce kimse farkında
        /// olmadan vatandaşa SMS göndermeye başlamaz. Açmak bilinçli bir adımdır.
        /// </summary>
        public bool LiveSendEnabled { get; set; }

        public string Provider { get; set; } = nameof(SmsProvider.NetGSM);
        public string? ApiUrl { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        public string? Originator { get; set; }
        /// <summary>Asistel'in verdiği chargedParty; yalnız Asistel SOAP çağrısında kullanılır.</summary>
        public string? ChargedNumber { get; set; }
    }
}
