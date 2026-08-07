using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;

namespace CityCommunicationCenter.Api.Services;

/// <summary>
/// Cookie oturumundan SignalR hub kimlik doğrulaması için kısa ömürlü JWT üretir.
/// Web SPA cookie-only login kullanır; hub [Authorize] OpenIddict bearer bekler (#2353).
/// </summary>
public sealed class SignalRAccessTokenIssuer
{
    private readonly SymmetricSecurityKey _signingKey;
    private readonly string _issuer;
    private readonly string _audience;

    public SignalRAccessTokenIssuer(IConfiguration configuration)
    {
        var signingKeyValue = configuration["Authentication:SigningKey"]
            ?? throw new InvalidOperationException("Authentication:SigningKey must be configured.");
        _issuer = configuration["Authentication:Issuer"]
            ?? throw new InvalidOperationException("Authentication:Issuer must be configured.");
        _audience = configuration["Authentication:Audience"]
            ?? throw new InvalidOperationException("Authentication:Audience must be configured.");

        _signingKey = AuthenticationKeyFactory.CreateSigningKey(signingKeyValue);
    }

    public string CreateAccessToken(ClaimsPrincipal principal, TimeSpan lifetime)
    {
        ArgumentNullException.ThrowIfNull(principal);

        var identity = new ClaimsIdentity(
            principal.Claims,
            authenticationType: null,
            nameType: ClaimTypes.Name,
            roleType: ClaimTypes.Role);

        var handler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = identity,
            Expires = DateTime.UtcNow.Add(lifetime),
            Issuer = _issuer,
            Audience = _audience,
            SigningCredentials = new SigningCredentials(_signingKey, SecurityAlgorithms.HmacSha256),
        };

        return handler.WriteToken(handler.CreateToken(descriptor));
    }
}
