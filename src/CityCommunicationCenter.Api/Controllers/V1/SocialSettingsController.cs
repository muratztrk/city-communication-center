using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.SocialMedia;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

/// <summary>
/// Admin API for configuring social media integrations.
/// </summary>
[Route("api/v1/admin/social-settings")]
public sealed class SocialSettingsController : ApiControllerBase
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ISocialMediaClientFactory _clientFactory;

    public SocialSettingsController(
        ITenantContextAccessor tenantContextAccessor,
        ISocialMediaSettingsProvider settingsProvider,
        ISocialMediaClientFactory clientFactory)
        : base(tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _clientFactory = clientFactory;
    }

    /// <summary>
    /// Get current social media configuration status (without exposing secrets).
    /// </summary>
    [HttpGet]
    public IActionResult GetSettings()
    {
        if (!TryGetTenantId(out var tenantId, out var error))
            return error;

        var settings = _settingsProvider.GetSettings(tenantId.Value);

        // Return status without exposing actual credentials
        return Ok(new
        {
            x = new
            {
                configured = !string.IsNullOrEmpty(settings?.X?.BearerToken),
                hasApiKey = !string.IsNullOrEmpty(settings?.X?.ApiKey),
                hasAccessToken = !string.IsNullOrEmpty(settings?.X?.AccessToken)
            },
            facebook = new
            {
                configured = !string.IsNullOrEmpty(settings?.Facebook?.PageAccessToken),
                hasPageId = !string.IsNullOrEmpty(settings?.Facebook?.PageId),
                hasAppId = !string.IsNullOrEmpty(settings?.Facebook?.AppId)
            },
            instagram = new
            {
                configured = !string.IsNullOrEmpty(settings?.Instagram?.AccessToken),
                hasAccountId = !string.IsNullOrEmpty(settings?.Instagram?.AccountId)
            },
            whatsApp = new
            {
                configured = !string.IsNullOrEmpty(settings?.WhatsApp?.AccessToken),
                hasPhoneNumberId = !string.IsNullOrEmpty(settings?.WhatsApp?.PhoneNumberId),
                hasBusinessAccountId = !string.IsNullOrEmpty(settings?.WhatsApp?.BusinessAccountId)
            }
        });
    }

    /// <summary>
    /// Configure X (Twitter) API credentials.
    /// </summary>
    [HttpPost("x")]
    public async Task<IActionResult> ConfigureX([FromBody] XSettingsRequest request, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
            return error;

        var settings = _settingsProvider.GetSettings(tenantId.Value) ?? new SocialMediaSettings();
        
        settings.X = new XSettings
        {
            ApiKey = request.ApiKey,
            ApiSecret = request.ApiSecret,
            AccessToken = request.AccessToken,
            AccessTokenSecret = request.AccessTokenSecret,
            BearerToken = request.BearerToken
        };

        await _settingsProvider.SaveSettingsAsync(tenantId.Value, settings, ct);

        return Ok(new { message = "X ayarları kaydedildi", configured = true });
    }

    /// <summary>
    /// Configure Facebook API credentials.
    /// </summary>
    [HttpPost("facebook")]
    public async Task<IActionResult> ConfigureFacebook([FromBody] FacebookSettingsRequest request, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
            return error;

        var settings = _settingsProvider.GetSettings(tenantId.Value) ?? new SocialMediaSettings();
        
        settings.Facebook = new FacebookSettings
        {
            AppId = request.AppId,
            AppSecret = request.AppSecret,
            PageAccessToken = request.PageAccessToken,
            PageId = request.PageId,
            WebhookVerifyToken = request.WebhookVerifyToken
        };

        await _settingsProvider.SaveSettingsAsync(tenantId.Value, settings, ct);

        return Ok(new { message = "Facebook ayarları kaydedildi", configured = true });
    }

    /// <summary>
    /// Configure Instagram API credentials.
    /// </summary>
    [HttpPost("instagram")]
    public async Task<IActionResult> ConfigureInstagram([FromBody] InstagramSettingsRequest request, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
            return error;

        var settings = _settingsProvider.GetSettings(tenantId.Value) ?? new SocialMediaSettings();
        
        settings.Instagram = new InstagramSettings
        {
            AccountId = request.AccountId,
            AccessToken = request.AccessToken,
            LinkedPageId = request.LinkedPageId
        };

        await _settingsProvider.SaveSettingsAsync(tenantId.Value, settings, ct);

        return Ok(new { message = "Instagram ayarları kaydedildi", configured = true });
    }

    /// <summary>
    /// Configure WhatsApp Business API credentials.
    /// </summary>
    [HttpPost("whatsapp")]
    public async Task<IActionResult> ConfigureWhatsApp([FromBody] WhatsAppSettingsRequest request, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
            return error;

        var settings = _settingsProvider.GetSettings(tenantId.Value) ?? new SocialMediaSettings();
        
        settings.WhatsApp = new WhatsAppSettings
        {
            BusinessAccountId = request.BusinessAccountId,
            PhoneNumberId = request.PhoneNumberId,
            AccessToken = request.AccessToken,
            WebhookVerifyToken = request.WebhookVerifyToken
        };

        await _settingsProvider.SaveSettingsAsync(tenantId.Value, settings, ct);

        return Ok(new { message = "WhatsApp ayarları kaydedildi", configured = true });
    }

    /// <summary>
    /// Test connection for a specific platform.
    /// </summary>
    [HttpPost("{channel}/test")]
    public async Task<IActionResult> TestConnection(string channel, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
            return error;

        if (!Enum.TryParse<SocialChannel>(channel, true, out var socialChannel))
            return BadRequest(new { error = "Geçersiz kanal" });

        var client = _clientFactory.GetClient(socialChannel, tenantId.Value);
        if (client == null)
            return BadRequest(new { error = $"{channel} yapılandırılmamış" });

        var isConnected = await client.ValidateConnectionAsync(ct);

        return Ok(new
        {
            channel,
            connected = isConnected,
            message = isConnected ? "Bağlantı başarılı" : "Bağlantı başarısız"
        });
    }

    /// <summary>
    /// Delete configuration for a platform.
    /// </summary>
    [HttpDelete("{channel}")]
    public async Task<IActionResult> DeleteConfiguration(string channel, CancellationToken ct)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
            return error;

        var settings = _settingsProvider.GetSettings(tenantId.Value);
        if (settings == null)
            return NotFound();

        switch (channel.ToLowerInvariant())
        {
            case "x":
                settings.X = null;
                break;
            case "facebook":
                settings.Facebook = null;
                break;
            case "instagram":
                settings.Instagram = null;
                break;
            case "whatsapp":
                settings.WhatsApp = null;
                break;
            default:
                return BadRequest(new { error = "Geçersiz kanal" });
        }

        await _settingsProvider.SaveSettingsAsync(tenantId.Value, settings, ct);

        return Ok(new { message = $"{channel} yapılandırması silindi" });
    }
}

#region Request DTOs

public class XSettingsRequest
{
    public string? ApiKey { get; set; }
    public string? ApiSecret { get; set; }
    public string? AccessToken { get; set; }
    public string? AccessTokenSecret { get; set; }
    public string? BearerToken { get; set; }
}

public class FacebookSettingsRequest
{
    public string? AppId { get; set; }
    public string? AppSecret { get; set; }
    public string? PageAccessToken { get; set; }
    public string? PageId { get; set; }
    public string? WebhookVerifyToken { get; set; }
}

public class InstagramSettingsRequest
{
    public string? AccountId { get; set; }
    public string? AccessToken { get; set; }
    public string? LinkedPageId { get; set; }
}

public class WhatsAppSettingsRequest
{
    public string? BusinessAccountId { get; set; }
    public string? PhoneNumberId { get; set; }
    public string? AccessToken { get; set; }
    public string? WebhookVerifyToken { get; set; }
}

#endregion
