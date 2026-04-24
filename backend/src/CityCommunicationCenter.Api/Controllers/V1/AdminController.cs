using CityCommunicationCenter.Application.Features.Admin;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/admin")]
[TenantRequired]
[Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
public sealed class AdminController : ApiControllerBase
{
    private readonly IMediator _sender;

    public AdminController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("tenants/{tenantId:guid}/settings")]
    public async Task<ActionResult<TenantSettingsResponse>> GetTenantSettings(Guid tenantId, CancellationToken cancellationToken)
    {
        var settings = await _sender.Send(new GetTenantSettingsQuery(tenantId), cancellationToken);

        if (settings is null)
        {
            return NotFound();
        }

        return Ok(settings);
    }

    [HttpPut("tenants/{tenantId:guid}/settings")]
    public async Task<IActionResult> UpdateTenantSettings(
        Guid tenantId,
        [FromBody] UpdateTenantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        await _sender.Send(
            new UpdateTenantSettingsCommand(
                tenantId,
                request.DisplayName,
                request.DeploymentMode,
                request.Theme,
                request.Domain,
                request.DefaultSlaHours),
            cancellationToken);
        return NoContent();
    }

    [HttpGet("tenants/{tenantId:guid}/appearance")]
    public async Task<ActionResult<TenantAppearanceResponse>> GetTenantAppearance(Guid tenantId, CancellationToken cancellationToken)
    {
        var appearance = await _sender.Send(new GetTenantAppearanceQuery(tenantId), cancellationToken);
        if (appearance is null)
        {
            return NotFound();
        }

        return Ok(appearance);
    }

    [HttpPut("tenants/{tenantId:guid}/appearance")]
    public async Task<IActionResult> UpdateTenantAppearance(
        Guid tenantId,
        [FromBody] UpdateTenantAppearanceRequest request,
        CancellationToken cancellationToken)
    {
        await _sender.Send(
            new UpdateTenantAppearanceCommand(
                tenantId,
                request.ThemePreset,
                request.PrimaryColor,
                request.SecondaryColor,
                request.AccentColor,
                request.NeutralColor,
                request.SurfaceColor,
                request.BackgroundColor,
                request.HeaderGradientFrom,
                request.HeaderGradientTo,
                request.SidebarBackgroundColor,
                request.SidebarForegroundColor,
                request.LogoUrl,
                request.LoginBackgroundImageUrl),
            cancellationToken);

        return NoContent();
    }

    [HttpGet("tenants/{tenantId:guid}/ldap-settings")]
    public async Task<ActionResult<TenantLdapSettingsResponse>> GetTenantLdapSettings(Guid tenantId, CancellationToken cancellationToken)
    {
        var settings = await _sender.Send(new GetTenantLdapSettingsQuery(tenantId), cancellationToken);

        if (settings is null)
        {
            return NotFound();
        }

        return Ok(settings);
    }

    [HttpPut("tenants/{tenantId:guid}/ldap-settings")]
    public async Task<IActionResult> UpdateTenantLdapSettings(
        Guid tenantId,
        [FromBody] UpdateTenantLdapSettingsRequest request,
        CancellationToken cancellationToken)
    {
        await _sender.Send(
            new UpdateTenantLdapSettingsCommand(
                tenantId,
                request.Enabled,
                request.Host,
                request.Port,
                request.UseSsl,
                request.IgnoreCertificateErrors,
                request.Domain,
                request.SearchBase,
                request.BindDn,
                request.BindPassword,
                request.ClearBindPassword,
                request.UserAttribute),
            cancellationToken);

        return NoContent();
    }

    [HttpPost("tenants/{tenantId:guid}/ldap-settings/test-connectivity")]
    public async Task<ActionResult<TestLdapConnectivityResponse>> TestLdapConnectivity(
        Guid tenantId,
        [FromBody] TestLdapConnectivityRequest request,
        [FromServices] ILdapAuthenticationService ldapService,
        CancellationToken cancellationToken)
    {
        var parameters = new LdapConnectivityTestParameters(
            request.Host ?? string.Empty,
            request.Port,
            request.UseSsl,
            request.IgnoreCertificateErrors,
            request.Domain,
            request.SearchBase,
            request.BindDn,
            request.BindPassword);

        var result = await ldapService.TestConnectivityAsync(parameters, cancellationToken);

        return Ok(new TestLdapConnectivityResponse(result.Success, result.Message));
    }

    [HttpPost("tenants/{tenantId:guid}/ldap-settings/test-user-credentials")]
    public async Task<ActionResult<TestLdapUserCredentialsResponse>> TestLdapUserCredentials(
        Guid tenantId,
        [FromBody] TestLdapUserCredentialsRequest request,
        [FromServices] ILdapAuthenticationService ldapService,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Ok(new TestLdapUserCredentialsResponse(false, null, null, "Username and password are required."));
        }

        var result = await ldapService.AuthenticateAsync(tenantId, request.Username, request.Password, cancellationToken);

        if (result is null)
        {
            return Ok(new TestLdapUserCredentialsResponse(false, null, null, "Authentication failed. Check username and password."));
        }

        return Ok(new TestLdapUserCredentialsResponse(true, result.DisplayName, result.Email, "Authentication successful."));
    }

    [HttpGet("tenants/{tenantId:guid}/authentication-policy")]
    public async Task<ActionResult<TenantAuthenticationPolicyResponse>> GetTenantAuthenticationPolicy(Guid tenantId, CancellationToken cancellationToken)
    {
        var settings = await _sender.Send(new GetTenantAuthenticationPolicyQuery(tenantId), cancellationToken);

        if (settings is null)
        {
            return NotFound();
        }

        return Ok(settings);
    }

    [HttpPut("tenants/{tenantId:guid}/authentication-policy")]
    public async Task<IActionResult> UpdateTenantAuthenticationPolicy(
        Guid tenantId,
        [FromBody] UpdateTenantAuthenticationPolicyRequest request,
        CancellationToken cancellationToken)
    {
        await _sender.Send(
            new UpdateTenantAuthenticationPolicyCommand(
                tenantId,
                request.AutomaticSignInEnabled,
                request.AutomaticSignInMode,
                request.TrustedNetworkCidrs ?? [],
                request.TrustedProxyCidrs ?? [],
                request.IdentityHeaderName,
                request.RequireSecondFactorOutsideTrustedNetwork,
                request.SecondFactorProvider,
                request.CodeLength,
                request.CodeTtlSeconds,
                request.AllowMockCodePreview,
                request.WebhookUrl),
            cancellationToken);

        return NoContent();
    }

    [HttpPost("workflows/publish")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> PublishWorkflow([FromBody] PublishWorkflowRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new PublishWorkflowCommand(request.WorkflowName, request.Version, request.Description),
            cancellationToken);

        return Accepted(response);
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<IEnumerable<AuditLogResponse>>> GetAuditLogs(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetAuditLogsQuery(RequiredTenantId), cancellationToken);
        return Ok(response);
    }
}
