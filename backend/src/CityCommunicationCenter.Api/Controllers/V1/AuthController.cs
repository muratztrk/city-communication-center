using CityCommunicationCenter.Api.Services;
using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Application.Features.Auth;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.Extensions.Localization;
using Microsoft.IdentityModel.Tokens;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public sealed class AuthController : ControllerBase
{
    private const string PasswordGrantExchangeTicketPrefix = "auth-ticket:";
    private readonly IMediator _sender;
    private readonly IConfiguration _configuration;
    private readonly ITenantAuthenticationPolicyService _tenantAuthenticationPolicyService;
    private readonly IRequestNetworkEvaluator _requestNetworkEvaluator;
    private readonly IRecaptchaVerificationService _recaptchaVerificationService;
    private readonly IStringLocalizer<SharedResource> _localizer;
    private readonly SignalRAccessTokenIssuer _signalRAccessTokenIssuer;

    public AuthController(
        IMediator sender,
        IConfiguration configuration,
        ITenantAuthenticationPolicyService tenantAuthenticationPolicyService,
        IRequestNetworkEvaluator requestNetworkEvaluator,
        IRecaptchaVerificationService recaptchaVerificationService,
        IStringLocalizer<SharedResource> localizer,
        SignalRAccessTokenIssuer signalRAccessTokenIssuer)
    {
        _sender = sender;
        _configuration = configuration;
        _tenantAuthenticationPolicyService = tenantAuthenticationPolicyService;
        _requestNetworkEvaluator = requestNetworkEvaluator;
        _recaptchaVerificationService = recaptchaVerificationService;
        _localizer = localizer;
        _signalRAccessTokenIssuer = signalRAccessTokenIssuer;
    }

    [HttpPost("/connect/token")]
    [AllowAnonymous]
    [Consumes("application/x-www-form-urlencoded")]
    [ProducesResponseType<ConnectTokenResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ConnectToken(CancellationToken cancellationToken)
    {
        var request = Microsoft.AspNetCore.OpenIddictServerAspNetCoreHelpers.GetOpenIddictServerRequest(HttpContext);
        if (request is null)
        {
            return BadRequest(new { error = Errors.InvalidRequest, error_description = _localizer["AuthRequestUnreadable"].Value });
        }

        if (!string.Equals(request.GrantType, GrantTypes.Password, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = Errors.UnsupportedGrantType, error_description = _localizer["AuthPasswordGrantOnly"].Value });
        }

        var tenantId = await ResolveTenantIdAsync(request.GetParameter("tenant_id")?.ToString(), cancellationToken);
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = Errors.InvalidRequest, error_description = _localizer["AuthCredentialsRequired"].Value });
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return BadRequest(new { error = Errors.InvalidRequest, error_description = _localizer["AuthTenantRequired"].Value });
        }

        if (Guid.TryParse(tenantId, out var parsedTenantId))
        {
            var captchaFailure = await ValidateRecaptchaIfRequiredAsync(
                parsedTenantId,
                request.Username,
                request.GetParameter("recaptcha_token")?.ToString(),
                cancellationToken);
            if (captchaFailure is not null)
            {
                return captchaFailure;
            }

            if (await RequiresSecondFactorAsync(parsedTenantId, request.Username, cancellationToken))
            {
                return Unauthorized(new { error = Errors.InvalidGrant, error_description = _localizer["AuthSecondFactorRequired"].Value });
            }
        }

        var result = await _sender.Send(
            new AuthenticateUserCommand(request.Username, request.Password, tenantId),
            cancellationToken);
        if (result is null)
        {
            return Unauthorized(new { error = Errors.InvalidGrant, error_description = _localizer["AuthInvalidCredentials"].Value });
        }

        var principal = CreatePrincipal(result);
        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpGet("/connect/authorize")]
    [Authorize(AuthenticationSchemes = AuthorizationPolicies.SessionCookieScheme)]
    public IActionResult AuthorizeMobileClient()
    {
        var request = Microsoft.AspNetCore.OpenIddictServerAspNetCoreHelpers.GetOpenIddictServerRequest(HttpContext);
        if (request is null)
        {
            return BadRequest(new { error = Errors.InvalidRequest, error_description = _localizer["AuthRequestUnreadable"].Value });
        }

        var mobileClient = MobileOidcClientConfiguration.FromConfiguration(_configuration);
        if (!mobileClient.Matches(request.ClientId, request.RedirectUri))
        {
            return BadRequest(new { error = Errors.InvalidClient, error_description = "Geçersiz mobil istemci veya yönlendirme adresi." });
        }

        var requestedScopes = request.GetScopes();
        var allowedScopes = new HashSet<string>(StringComparer.Ordinal)
        {
            "openid", "profile", "email", "ccc_api"
        };
        if (requestedScopes.Any(scope => !allowedScopes.Contains(scope)))
        {
            return BadRequest(new { error = Errors.InvalidScope, error_description = "Geçersiz bir mobil erişim kapsamı istendi." });
        }

        // The browser session was created by the established server-side local/LDAP
        // authentication flow.  The native client only receives protocol tokens.
        var principal = new ClaimsPrincipal(User);
        principal.SetScopes(requestedScopes);
        principal.SetAudiences(_configuration["Authentication:Audience"] ?? "city-communication-center-api");

        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(request.TenantId, cancellationToken);
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return BadRequest(new { error = _localizer["AuthTenantRequired"].Value });
        }

        if (Guid.TryParse(tenantId, out var parsedTenantId))
        {
            var captchaFailure = await ValidateRecaptchaIfRequiredAsync(
                parsedTenantId,
                request.Username,
                request.RecaptchaToken,
                cancellationToken);
            if (captchaFailure is not null)
            {
                return captchaFailure;
            }

            if (await RequiresSecondFactorAsync(parsedTenantId, request.Username, cancellationToken))
            {
                return Unauthorized(new { error = _localizer["AuthSecondFactorRequired"].Value });
            }
        }

        var result = await _sender.Send(
            new AuthenticateUserCommand(
                request.Username,
                request.Password,
                tenantId),
            cancellationToken);
        if (result is null)
        {
            return Unauthorized(new { error = _localizer["AuthInvalidCredentials"].Value });
        }

        return Ok(new LoginResponse(
            result.UserId.ToString(),
            result.Username,
            result.DisplayName,
            string.IsNullOrWhiteSpace(result.Email) ? null : result.Email,
            result.RoleCode,
            result.TenantId.ToString(),
            result.TenantName,
            result.AuthenticationMode));
    }

    [HttpPost("session/login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> SessionLogin([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(request.TenantId, cancellationToken);
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return BadRequest(new { error = _localizer["AuthTenantRequired"].Value });
        }

        if (Guid.TryParse(tenantId, out var parsedTenantId))
        {
            var captchaFailure = await ValidateRecaptchaIfRequiredAsync(
                parsedTenantId,
                request.Username,
                request.RecaptchaToken,
                cancellationToken);
            if (captchaFailure is not null)
            {
                return captchaFailure;
            }

            if (await RequiresSecondFactorAsync(parsedTenantId, request.Username, cancellationToken))
            {
                return Unauthorized(new { error = _localizer["AuthSecondFactorRequired"].Value });
            }
        }

        var result = await _sender.Send(
            new AuthenticateUserCommand(
                request.Username,
                request.Password,
                tenantId),
            cancellationToken);
        if (result is null)
        {
            return Unauthorized(new { error = _localizer["AuthInvalidCredentials"].Value });
        }

        var principal = CreatePrincipal(result, AuthorizationPolicies.SessionCookieScheme);
        await HttpContext.SignInAsync(
            AuthorizationPolicies.SessionCookieScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                IssuedUtc = DateTimeOffset.UtcNow,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8),
            });

        return Ok(ToLoginResponse(result));
    }

    [HttpPost("session/logout")]
    [AllowAnonymous]
    public async Task<IActionResult> SessionLogout()
    {
        await HttpContext.SignOutAsync(AuthorizationPolicies.SessionCookieScheme);
        return NoContent();
    }

    [HttpGet("session/me")]
    [Authorize(AuthenticationSchemes = AuthorizationPolicies.SessionCookieScheme)]
    public async Task<ActionResult<AuthenticatedUserProfileResponse>> GetSessionUser(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetAuthenticatedUserProfileQuery(User), cancellationToken);
        return Ok(response);
    }

    [HttpPost("session/signalr-access-token")]
    [Authorize(AuthenticationSchemes = AuthorizationPolicies.SessionCookieScheme)]
    [ProducesResponseType<SignalRAccessTokenResponse>(StatusCodes.Status200OK)]
    public ActionResult<SignalRAccessTokenResponse> IssueSignalRAccessToken()
    {
        var lifetime = TimeSpan.FromHours(8);
        var accessToken = _signalRAccessTokenIssuer.CreateAccessToken(User, lifetime);
        return Ok(new SignalRAccessTokenResponse(accessToken, (int)lifetime.TotalSeconds));
    }

    [HttpPost("interactive/start")]
    [AllowAnonymous]
    public async Task<ActionResult<StartInteractiveAuthenticationResponse>> StartInteractiveAuthentication(
        [FromBody] StartInteractiveAuthenticationRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(request.TenantId, cancellationToken);
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return BadRequest(new StartInteractiveAuthenticationResponse(
                "Failed",
                false,
                false,
                null,
                null,
                null,
                null,
                _localizer["AuthTenantRequired"].Value,
                null,
                null,
                null,
                false));
        }

        if (Guid.TryParse(tenantId, out var parsedTenantId)
            && !string.IsNullOrWhiteSpace(request.Username)
            && !string.IsNullOrWhiteSpace(request.Password))
        {
            var captchaFailure = await ValidateRecaptchaIfRequiredAsync(
                parsedTenantId,
                request.Username,
                request.RecaptchaToken,
                cancellationToken);
            if (captchaFailure is not null)
            {
                return captchaFailure;
            }
        }

        var response = await _sender.Send(
            new StartInteractiveAuthenticationCommand(tenantId, request.Username, request.Password),
            cancellationToken);

        if (response.ChallengeWithNegotiate)
        {
            return Challenge(NegotiateDefaults.AuthenticationScheme);
        }

        return Ok(response);
    }

    [HttpPost("interactive/verify")]
    [AllowAnonymous]
    public async Task<ActionResult<VerifyInteractiveAuthenticationResponse>> VerifyInteractiveAuthentication(
        [FromBody] VerifyInteractiveAuthenticationRequest request,
        CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(request.TenantId, cancellationToken);
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return BadRequest(new VerifyInteractiveAuthenticationResponse(
                "Failed",
                null,
                _localizer["AuthTenantRequired"].Value,
                null,
                null,
                null));
        }

        var response = await _sender.Send(
            new VerifyInteractiveAuthenticationCommand(tenantId, request.ChallengeId, request.Code),
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("tenant-context")]
    [AllowAnonymous]
    public async Task<ActionResult<TenantLoginContextResponse>> GetTenantLoginContext(CancellationToken cancellationToken)
    {
        var tenantIdHeader = Request.Headers["X-Tenant-Id"].FirstOrDefault();
        Guid? tenantId = Guid.TryParse(tenantIdHeader, out var parsedTenantId) ? parsedTenantId : null;
        var response = await _sender.Send(new GetTenantLoginContextQuery(GetRequestHost(), tenantId), cancellationToken);

        if (response.ResolvedTenant is null)
        {
            return Ok(response);
        }

        var network = await _requestNetworkEvaluator.EvaluateAsync(response.ResolvedTenant.TenantId, cancellationToken);
        var authPolicy = await _tenantAuthenticationPolicyService.GetRuntimeSettingsAsync(response.ResolvedTenant.TenantId, cancellationToken);
        var requiresCaptcha = authPolicy.RecaptchaEnabled
            && _recaptchaVerificationService.IsRequired(network.IsTrustedNetwork);

        return Ok(response with
        {
            IsTrustedNetwork = network.IsTrustedNetwork,
            RequiresCaptcha = requiresCaptcha,
            RecaptchaSiteKey = requiresCaptcha ? _recaptchaVerificationService.SiteKey : null,
        });
    }

    [HttpPost("reset-local-password")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ResetLocalPassword(
        [FromBody] ResetLocalUserPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await _sender.Send(new ResetLocalUserPasswordCommand(request.TenantId, request.Email), cancellationToken);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthenticatedUserProfileResponse>> GetCurrentUser(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetAuthenticatedUserProfileQuery(User), cancellationToken);
        return Ok(response);
    }

    [HttpGet("tenants")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<TenantLookupResponse>>> GetTenants(CancellationToken cancellationToken)
    {
        var tenants = await _sender.Send(new GetTenantsQuery(), cancellationToken);
        return Ok(tenants);
    }

    [HttpPost("bootstrap")]
    [AllowAnonymous]
    public async Task<IActionResult> Bootstrap(
        [FromBody] BootstrapTenantRequest request,
        [FromServices] IWebHostEnvironment environment,
        CancellationToken cancellationToken)
    {
        if (!environment.IsDevelopment())
        {
            return NotFound();
        }

        var response = await _sender.Send(
            new BootstrapTenantCommand(
                request.MunicipalityName,
                request.DisplayName,
                request.DeploymentMode,
                request.AdminUsername,
                request.AdminDisplayName,
                request.AdminEmail,
                request.AdminPassword),
            cancellationToken);

        if (response is null)
        {
            return Conflict(new { error = _localizer["BootstrapCompleted"].Value });
        }

        return Ok(response);
    }
    private static LoginResponse ToLoginResponse(AuthenticatedTokenPayload payload)
    {
        return new LoginResponse(
            payload.UserId.ToString(),
            payload.Username,
            payload.DisplayName,
            string.IsNullOrWhiteSpace(payload.Email) ? null : payload.Email,
            payload.RoleCode,
            payload.TenantId.ToString(),
            payload.TenantName,
            payload.AuthenticationMode);
    }

    private ClaimsPrincipal CreatePrincipal(AuthenticatedTokenPayload payload, string? authenticationType = null)
    {
        var audience = _configuration["Authentication:Audience"] ?? "city-communication-center-api";
        var userId = payload.UserId.ToString();
        var departmentId = payload.DepartmentId.ToString();
        var tenantId = payload.TenantId.ToString();

        var identity = new ClaimsIdentity(
            authenticationType ?? TokenValidationParameters.DefaultAuthenticationType,
            Claims.Name,
            Claims.Role);

        identity.AddClaim(new Claim(Claims.Subject, userId));
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId));
        identity.AddClaim(new Claim(Claims.Name, payload.DisplayName));
        identity.AddClaim(new Claim("displayName", payload.DisplayName));
        if (!string.IsNullOrWhiteSpace(payload.Username))
        {
            identity.AddClaim(new Claim(Claims.PreferredUsername, payload.Username));
        }
        identity.AddClaim(new Claim(Claims.Role, payload.RoleCode));
        foreach (var additionalRole in payload.AdditionalRoleCodes)
        {
            if (!string.Equals(additionalRole, payload.RoleCode, StringComparison.OrdinalIgnoreCase))
            {
                identity.AddClaim(new Claim(Claims.Role, additionalRole));
            }
        }
        identity.AddClaim(new Claim("tenant_id", tenantId));
        identity.AddClaim(new Claim("tenantId", tenantId));
        identity.AddClaim(new Claim("tenant_name", payload.TenantName));
        identity.AddClaim(new Claim("department_id", departmentId));
        identity.AddClaim(new Claim("ccc_sid", payload.ActiveSessionId.ToString()));

        if (!string.IsNullOrWhiteSpace(payload.Email))
        {
            identity.AddClaim(new Claim(Claims.Email, payload.Email));
        }

        var principal = new ClaimsPrincipal(identity);
        principal.SetAudiences(audience);
        principal.SetDestinations(static claim => claim.Type switch
        {
            Claims.Name or ClaimTypes.NameIdentifier or Claims.Subject or Claims.Email or Claims.PreferredUsername or Claims.Role or "displayName" or "tenant_id" or "tenantId" or "tenant_name" or "department_id" or "ccc_sid"
                => [Destinations.AccessToken, Destinations.IdentityToken],
            _ => []
        });

        return principal;
    }

    private async Task<string?> ResolveTenantIdAsync(string? explicitTenantId, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(explicitTenantId))
        {
            return explicitTenantId.Trim();
        }

        var tenantIdHeader = Request.Headers["X-Tenant-Id"].FirstOrDefault();
        Guid? tenantId = Guid.TryParse(tenantIdHeader, out var parsedFallback) ? parsedFallback : null;
        var response = await _sender.Send(new GetTenantLoginContextQuery(GetRequestHost(), tenantId), cancellationToken);
        return response.ResolvedTenant?.TenantId.ToString();
    }

    private string? GetRequestHost()
        => HttpContext.Request.Host.HasValue
            ? HttpContext.Request.Host.Host
            : null;

    private async Task<bool> RequiresSecondFactorAsync(Guid tenantId, string username, CancellationToken cancellationToken)
    {
        if (username.StartsWith(PasswordGrantExchangeTicketPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        var policy = await _tenantAuthenticationPolicyService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!policy.RequireSecondFactorOutsideTrustedNetwork)
        {
            return false;
        }

        var network = await _requestNetworkEvaluator.EvaluateAsync(tenantId, cancellationToken);
        return !network.IsTrustedNetwork;
    }

    private async Task<ActionResult?> ValidateRecaptchaIfRequiredAsync(
        Guid tenantId,
        string? username,
        string? recaptchaToken,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(username)
            && username.StartsWith(PasswordGrantExchangeTicketPrefix, StringComparison.Ordinal))
        {
            return null;
        }

        var network = await _requestNetworkEvaluator.EvaluateAsync(tenantId, cancellationToken);
        if (!_recaptchaVerificationService.IsRequired(network.IsTrustedNetwork))
        {
            return null;
        }

        var authPolicy = await _tenantAuthenticationPolicyService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!authPolicy.RecaptchaEnabled)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(recaptchaToken))
        {
            return BadRequest(new { error = _localizer["AuthRecaptchaRequired"].Value });
        }

        if (!await _recaptchaVerificationService.VerifyAsync(recaptchaToken, network.ClientIp, cancellationToken))
        {
            return BadRequest(new { error = _localizer["AuthRecaptchaFailed"].Value });
        }

        return null;
    }
}
