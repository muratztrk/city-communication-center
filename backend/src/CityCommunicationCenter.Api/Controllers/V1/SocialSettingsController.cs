using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Api.Controllers.V1;

/// <summary>
/// Admin API for configuring social media integrations.
/// </summary>
[Route("api/v1/admin/social-settings")]
[TenantRequired]
[Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
public sealed class SocialSettingsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public SocialSettingsController(IMediator sender)
    {
        _sender = sender;
    }

    /// <summary>
    /// Get current social media configuration status (without exposing secrets).
    /// </summary>
    [HttpGet("")]
    [ProducesResponseType<SocialSettingsStatusResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<SocialSettingsStatusResponse>> GetSettings(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSocialSettingsStatusQuery(), cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Configure X (Twitter) API credentials.
    /// </summary>
    [HttpPost("x")]
    public async Task<ActionResult<SocialSettingsSaveResponse>> ConfigureX([FromBody] XSettingsRequest request, CancellationToken ct)
    {
        var response = await _sender.Send(new ConfigureXCommand(request), ct);
        return Ok(response);
    }

    /// <summary>
    /// Configure Facebook API credentials.
    /// </summary>
    [HttpPost("facebook")]
    public async Task<ActionResult<SocialSettingsSaveResponse>> ConfigureFacebook([FromBody] FacebookSettingsRequest request, CancellationToken ct)
    {
        var response = await _sender.Send(new ConfigureFacebookCommand(request), ct);
        return Ok(response);
    }

    /// <summary>
    /// Configure Instagram API credentials.
    /// </summary>
    [HttpPost("instagram")]
    public async Task<ActionResult<SocialSettingsSaveResponse>> ConfigureInstagram([FromBody] InstagramSettingsRequest request, CancellationToken ct)
    {
        var response = await _sender.Send(new ConfigureInstagramCommand(request), ct);
        return Ok(response);
    }

    /// <summary>
    /// Configure WhatsApp Business API credentials.
    /// </summary>
    [HttpPost("whatsapp")]
    public async Task<ActionResult<SocialSettingsSaveResponse>> ConfigureWhatsApp([FromBody] WhatsAppSettingsRequest request, CancellationToken ct)
    {
        var response = await _sender.Send(new ConfigureWhatsAppCommand(request), ct);
        return Ok(response);
    }

    /// <summary>
    /// Configure e-Devlet integration credentials.
    /// </summary>
    [HttpPost("edevlet")]
    public async Task<ActionResult<SocialSettingsSaveResponse>> ConfigureEDevlet([FromBody] EDevletSettingsRequest request, CancellationToken ct)
    {
        var response = await _sender.Send(new ConfigureEDevletCommand(request), ct);
        return Ok(response);
    }

    /// <summary>
    /// Configure Email (IMAP/SMTP) integration credentials.
    /// </summary>
    [HttpPost("email")]
    public async Task<ActionResult<SocialSettingsSaveResponse>> ConfigureEmail([FromBody] EmailSettingsRequest request, CancellationToken ct)
    {
        var response = await _sender.Send(new ConfigureEmailCommand(request), ct);
        return Ok(response);
    }

    /// <summary>
    /// Test connection for a specific platform.
    /// </summary>
    [HttpPost("{channel}/test")]
    public async Task<ActionResult<SocialConnectionTestResponse>> TestConnection(string channel, CancellationToken ct)
    {
        var result = await _sender.Send(new TestSocialConnectionCommand(channel), ct);
        if (!result.IsValid)
            return BadRequest(new { error = result.Response.Message });
        if (!result.IsConfigured)
            return BadRequest(new { error = result.Response.Message });

        return Ok(result.Response);
    }

    /// <summary>
    /// Delete configuration for a platform.
    /// </summary>
    [HttpDelete("{channel}")]
    public async Task<ActionResult<SocialSettingsSaveResponse>> DeleteConfiguration(string channel, CancellationToken ct)
    {
        var result = await _sender.Send(new DeleteSocialConfigurationCommand(channel), ct);
        if (!result.IsValidChannel)
            return BadRequest(new { error = "Gecersiz kanal" });
        if (!result.Exists)
            return NotFound();

        return Ok(result.Response);
    }
}
