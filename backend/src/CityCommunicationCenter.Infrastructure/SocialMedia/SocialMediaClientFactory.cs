using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace CityCommunicationCenter.Infrastructure.SocialMedia;

public class SocialMediaClientFactory : ISocialMediaClientFactory
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ISocialMediaSettingsProvider _settingsProvider;

    public SocialMediaClientFactory(
        IHttpClientFactory httpClientFactory,
        ISocialMediaSettingsProvider settingsProvider)
    {
        _httpClientFactory = httpClientFactory;
        _settingsProvider = settingsProvider;
    }

    public ISocialMediaClient? GetClient(SocialChannel channel, Guid tenantId)
    {
        var settings = _settingsProvider.GetSettings(tenantId);
        if (settings == null) return null;

        var httpClient = _httpClientFactory.CreateClient($"SocialMedia_{channel}");

        return channel switch
        {
            SocialChannel.X when settings.X != null => new XClient(httpClient, settings.X),
            SocialChannel.Facebook when settings.Facebook != null => new FacebookClient(httpClient, settings.Facebook),
            SocialChannel.Instagram when settings.Instagram != null => new InstagramClient(httpClient, settings.Instagram),
            SocialChannel.WhatsApp when settings.WhatsApp != null => new WhatsAppClient(httpClient, settings.WhatsApp),
            _ => null
        };
    }

    public IEnumerable<ISocialMediaClient> GetAllClients(Guid tenantId)
    {
        var channels = new[] { SocialChannel.X, SocialChannel.Facebook, SocialChannel.Instagram, SocialChannel.WhatsApp };
        
        foreach (var channel in channels)
        {
            var client = GetClient(channel, tenantId);
            if (client != null)
                yield return client;
        }
    }

    public bool IsChannelConfigured(SocialChannel channel, Guid tenantId)
    {
        var settings = _settingsProvider.GetSettings(tenantId);
        if (settings == null) return false;

        return channel switch
        {
            SocialChannel.X => !string.IsNullOrEmpty(settings.X?.BearerToken),
            SocialChannel.Facebook => !string.IsNullOrEmpty(settings.Facebook?.PageAccessToken),
            SocialChannel.Instagram => !string.IsNullOrEmpty(settings.Instagram?.AccessToken),
            SocialChannel.WhatsApp => !string.IsNullOrEmpty(settings.WhatsApp?.AccessToken),
            _ => false
        };
    }
}

public sealed class DatabaseSocialMediaSettingsProvider : ISocialMediaSettingsProvider
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly IDataProtector _dataProtector;
    private readonly IApplicationDbContext _dbContext;

    public DatabaseSocialMediaSettingsProvider(IApplicationDbContext dbContext, IDataProtectionProvider dataProtectionProvider)
    {
        _dbContext = dbContext;
        _dataProtector = dataProtectionProvider.CreateProtector("CityCommunicationCenter.SocialMediaSettings.v1");
    }

    public SocialMediaSettings? GetSettings(Guid tenantId)
    {
        var tenantSetting = _dbContext.TenantSettings
            .AsNoTracking()
            .SingleOrDefault(entity => entity.TenantId == tenantId);

        if (string.IsNullOrWhiteSpace(tenantSetting?.SocialSettingsJson))
        {
            return null;
        }

        var payload = tenantSetting.SocialSettingsJson;

        try
        {
            payload = _dataProtector.Unprotect(payload);
        }
        catch (CryptographicException)
        {
            // Backward compatibility for legacy plaintext records.
        }

        return JsonSerializer.Deserialize<SocialMediaSettings>(payload, SerializerOptions);
    }

    public async Task SaveSettingsAsync(Guid tenantId, SocialMediaSettings settings, CancellationToken ct = default)
    {
        var existing = await _dbContext.TenantSettings
            .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, ct);

        var payload = _dataProtector.Protect(JsonSerializer.Serialize(settings, SerializerOptions));

        if (existing is null)
        {
            _dbContext.TenantSettings.Add(new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
                DisplayName = string.Empty,
                DefaultSlaHours = 48,
                AutoRoutingEnabled = false,
                SocialSettingsJson = payload
            });

            await _dbContext.SaveChangesAsync(ct);

            return;
        }

        existing.SocialSettingsJson = payload;
        existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(ct);
    }
}
