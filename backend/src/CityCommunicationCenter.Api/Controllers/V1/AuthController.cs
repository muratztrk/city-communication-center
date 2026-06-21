using CityCommunicationCenter.Application.Features.Auth;
using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.Extensions.Localization;
using Microsoft.IdentityModel.Tokens;
using System.Net;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public sealed class AuthController : ControllerBase
{
    private const string ForwardedForHeader = "X-Forwarded-For";
    private const string PasswordGrantExchangeTicketPrefix = "auth-ticket:";
    private readonly IMediator _sender;
    private readonly IConfiguration _configuration;
    private readonly ITenantAuthenticationPolicyService _tenantAuthenticationPolicyService;
    private readonly IStringLocalizer<SharedResource> _localizer;

    public AuthController(
        IMediator sender,
        IConfiguration configuration,
        ITenantAuthenticationPolicyService tenantAuthenticationPolicyService,
        IStringLocalizer<SharedResource> localizer)
    {
        _sender = sender;
        _configuration = configuration;
        _tenantAuthenticationPolicyService = tenantAuthenticationPolicyService;
        _localizer = localizer;
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

        if (Guid.TryParse(tenantId, out var parsedTenantId)
            && await RequiresSecondFactorAsync(parsedTenantId, request.Username, cancellationToken))
        {
            return Unauthorized(new { error = Errors.InvalidGrant, error_description = _localizer["AuthSecondFactorRequired"].Value });
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

        if (Guid.TryParse(tenantId, out var parsedTenantId)
            && await RequiresSecondFactorAsync(parsedTenantId, request.Username, cancellationToken))
        {
            return Unauthorized(new { error = _localizer["AuthSecondFactorRequired"].Value });
        }

        var result = await _sender.Send(
            new AuthenticateUserCommand(request.Username, request.Password, tenantId),
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

        if (Guid.TryParse(tenantId, out var parsedTenantId)
            && await RequiresSecondFactorAsync(parsedTenantId, request.Username, cancellationToken))
        {
            return Unauthorized(new { error = _localizer["AuthSecondFactorRequired"].Value });
        }

        var result = await _sender.Send(
            new AuthenticateUserCommand(request.Username, request.Password, tenantId),
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
        return Ok(response);
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
        identity.AddClaim(new Claim("tenant_id", tenantId));
        identity.AddClaim(new Claim("tenantId", tenantId));
        identity.AddClaim(new Claim("tenant_name", payload.TenantName));
        identity.AddClaim(new Claim("department_id", departmentId));

        if (!string.IsNullOrWhiteSpace(payload.Email))
        {
            identity.AddClaim(new Claim(Claims.Email, payload.Email));
        }

        var principal = new ClaimsPrincipal(identity);
        principal.SetAudiences(audience);
        principal.SetDestinations(static claim => claim.Type switch
        {
            Claims.Name or ClaimTypes.NameIdentifier or Claims.Subject or Claims.Email or Claims.PreferredUsername or Claims.Role or "displayName" or "tenant_id" or "tenantId" or "tenant_name" or "department_id"
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

        var effectiveClientIp = ResolveEffectiveClientIp(policy.TrustedProxyCidrs);
        return effectiveClientIp is null || !IsMatch(effectiveClientIp, policy.TrustedNetworkCidrs);
    }

    private IPAddress? ResolveEffectiveClientIp(IReadOnlyList<string> trustedProxyCidrs)
    {
        var remoteIp = HttpContext.Connection.RemoteIpAddress;
        if (remoteIp is null)
        {
            return null;
        }

        if (!IsMatch(remoteIp, trustedProxyCidrs))
        {
            return remoteIp;
        }

        var forwardedFor = Request.Headers[ForwardedForHeader].ToString();
        var forwardedIp = forwardedFor
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(value => IPAddress.TryParse(value, out var parsed) ? parsed : null)
            .FirstOrDefault(parsed => parsed is not null);

        return forwardedIp ?? remoteIp;
    }

    private static bool IsMatch(IPAddress address, IReadOnlyList<string> cidrs)
    {
        return cidrs.Any(cidr => IpCidrRange.TryParse(cidr, out var range) && range.Contains(address));
    }

    private sealed class IpCidrRange
    {
        private readonly byte[] _networkBytes;

        private IpCidrRange(IPAddress networkAddress, int prefixLength)
        {
            NetworkAddress = networkAddress;
            PrefixLength = prefixLength;
            _networkBytes = networkAddress.GetAddressBytes();
        }

        public IPAddress NetworkAddress { get; }

        public int PrefixLength { get; }

        public bool Contains(IPAddress address)
        {
            var networkAddress = NetworkAddress.IsIPv4MappedToIPv6 ? NetworkAddress.MapToIPv4() : NetworkAddress;
            var candidateAddress = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
            var networkBytes = networkAddress.GetAddressBytes();
            var addressBytes = candidateAddress.GetAddressBytes();
            if (addressBytes.Length != networkBytes.Length)
            {
                return false;
            }

            var fullBytes = PrefixLength / 8;
            var remainingBits = PrefixLength % 8;

            for (var index = 0; index < fullBytes; index += 1)
            {
                if (networkBytes[index] != addressBytes[index])
                {
                    return false;
                }
            }

            if (remainingBits == 0)
            {
                return true;
            }

            var mask = (byte)(byte.MaxValue << (8 - remainingBits));
            return (networkBytes[fullBytes] & mask) == (addressBytes[fullBytes] & mask);
        }

        public static bool TryParse(string value, out IpCidrRange range)
        {
            range = null!;
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            var parts = value.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (!IPAddress.TryParse(parts[0], out var networkAddress))
            {
                return false;
            }

            var maxPrefixLength = networkAddress.GetAddressBytes().Length * 8;
            var prefixLength = maxPrefixLength;
            if (parts.Length == 2 && (!int.TryParse(parts[1], out prefixLength) || prefixLength < 0 || prefixLength > maxPrefixLength))
            {
                return false;
            }

            range = new IpCidrRange(networkAddress, prefixLength);
            return true;
        }
    }
}
