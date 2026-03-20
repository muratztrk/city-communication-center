using System.Security.Claims;
using CityCommunicationCenter.Application.Features.Auth;
using Microsoft.IdentityModel.Tokens;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public sealed class AuthController : ControllerBase
{
    private readonly ISender _sender;
    private readonly IConfiguration _configuration;

    public AuthController(ISender sender, IConfiguration configuration)
    {
        _sender = sender;
        _configuration = configuration;
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
            return BadRequest(new { error = Errors.InvalidRequest, error_description = "OpenIddict istegi okunamadi." });
        }

        if (!string.Equals(request.GrantType, GrantTypes.Password, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = Errors.UnsupportedGrantType, error_description = "Sadece password grant desteklenmektedir." });
        }

        var tenantId = request.GetParameter("tenant_id")?.ToString();
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = Errors.InvalidRequest, error_description = "Kullanıcı adı ve şifre gereklidir." });
        }

        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return BadRequest(new { error = Errors.InvalidRequest, error_description = "Belediye seçimi gereklidir." });
        }

        var result = await _sender.Send(
            new AuthenticateUserCommand(request.Username, request.Password, tenantId),
            cancellationToken);
        if (result is null)
        {
            return Unauthorized(new { error = Errors.InvalidGrant, error_description = "Geçersiz kullanıcı adı veya şifre." });
        }

        var principal = CreatePrincipal(result);
        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new AuthenticateUserCommand(request.Username, request.Password, request.TenantId),
            cancellationToken);
        if (result is null)
        {
            return Unauthorized(new { error = "Gecersiz kullanici adi veya sifre." });
        }

        return Ok(new LoginResponse(
            result.UserId.ToString(),
            result.DisplayName,
            result.Email,
            result.RoleCode,
            result.TenantId.ToString(),
            result.TenantName,
            result.AuthenticationMode));
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
    public async Task<IActionResult> Bootstrap([FromBody] BootstrapTenantRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new BootstrapTenantCommand(
                request.MunicipalityName,
                request.DisplayName,
                request.AdminDisplayName,
                request.AdminEmail,
                request.AdminPassword),
            cancellationToken);

        if (response is null)
        {
            return Conflict(new { error = "Kurulum zaten tamamlandı. Mevcut belediye kaydı kullanılmalıdır." });
        }

        return Ok(response);
    }
    private ClaimsPrincipal CreatePrincipal(AuthenticatedTokenPayload payload)
    {
        var audience = _configuration["Authentication:Audience"] ?? "city-communication-center-api";
        var userId = payload.UserId.ToString();
        var departmentId = payload.DepartmentId.ToString();
        var tenantId = payload.TenantId.ToString();

        var identity = new ClaimsIdentity(
            TokenValidationParameters.DefaultAuthenticationType,
            Claims.Name,
            Claims.Role);

        identity.AddClaim(new Claim(Claims.Subject, userId));
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId));
        identity.AddClaim(new Claim(Claims.Name, payload.DisplayName));
        identity.AddClaim(new Claim("displayName", payload.DisplayName));
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
            Claims.Name or ClaimTypes.NameIdentifier or Claims.Subject or Claims.Email or Claims.Role or "displayName" or "tenant_id" or "tenantId" or "tenant_name" or "department_id"
                => [Destinations.AccessToken],
            _ => []
        });

        return principal;
    }
}

