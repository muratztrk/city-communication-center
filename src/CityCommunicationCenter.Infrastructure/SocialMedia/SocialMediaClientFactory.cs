using CityCommunicationCenter.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;

namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// Factory for creating social media clients based on tenant settings.
/// Manages client instances and configuration per tenant.
/// </summary>
public interface ISocialMediaClientFactory
{
    /// <summary>
    /// Gets a client for the specified social channel and tenant.
    /// </summary>
    ISocialMediaClient? GetClient(SocialChannel channel, Guid tenantId);

    /// <summary>
    /// Gets all configured clients for a tenant.
    /// </summary>
    IEnumerable<ISocialMediaClient> GetAllClients(Guid tenantId);

    /// <summary>
    /// Validates if a channel is configured for a tenant.
    /// </summary>
    bool IsChannelConfigured(SocialChannel channel, Guid tenantId);
}

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

/// <summary>
/// Provides social media settings per tenant.
/// In production, this would load from TenantSettings table (encrypted).
/// </summary>
public interface ISocialMediaSettingsProvider
{
    SocialMediaSettings? GetSettings(Guid tenantId);
    Task SaveSettingsAsync(Guid tenantId, SocialMediaSettings settings, CancellationToken ct = default);
}

/// <summary>
/// Mock implementation for development.
/// In production, implement with database storage and encryption.
/// </summary>
public class InMemorySocialMediaSettingsProvider : ISocialMediaSettingsProvider
{
    private readonly Dictionary<Guid, SocialMediaSettings> _settings = new();

    public SocialMediaSettings? GetSettings(Guid tenantId)
    {
        return _settings.TryGetValue(tenantId, out var settings) ? settings : null;
    }

    public Task SaveSettingsAsync(Guid tenantId, SocialMediaSettings settings, CancellationToken ct = default)
    {
        _settings[tenantId] = settings;
        return Task.CompletedTask;
    }
}
