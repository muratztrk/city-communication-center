using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Api.Services;

public class AuthService
{
    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly IConfiguration _configuration;

    public AuthService(CityCommunicationCenterDbContext dbContext, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
    }

    public async Task<AuthResult?> AuthenticateAsync(string username, string password, string tenantId)
    {
        // Mock LDAP authentication - in production this would validate against AD
        // For development, we check against our Users table
        var user = await _dbContext.Users
            .WhereTenant(Guid.Parse(tenantId))
            .Where("Email = @Email", ("@Email", username))
            .FirstOrDefaultAsync();

        if (user == null)
        {
            // Try by display name for convenience
            user = await _dbContext.Users
                .WhereTenant(Guid.Parse(tenantId))
                .Where("DisplayName = @DisplayName", ("@DisplayName", username))
                .FirstOrDefaultAsync();
        }

        if (user == null)
            return null;

        // Mock password validation - accepts "password123" for all test users
        // In production, this would validate against LDAP/AD
        if (password != "password123")
            return null;

        if (!user.IsActive)
            return null;

        // Get tenant name
        var tenant = await _dbContext.Tenants
            .Where("TenantId = @TenantId", ("@TenantId", Guid.Parse(tenantId)))
            .FirstOrDefaultAsync();

        var token = GenerateJwtToken(user, tenantId);

        return new AuthResult
        {
            Token = token,
            UserId = user.UserId.ToString(),
            DisplayName = user.DisplayName,
            Email = user.Email ?? string.Empty,
            Role = user.RoleCode.ToString(),
            TenantId = tenantId,
            TenantName = tenant?.MunicipalityName ?? "Belediye",
            ExpiresAt = DateTime.UtcNow.AddHours(8)
        };
    }

    private string GenerateJwtToken(ApplicationUser user, string tenantId)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? "CCC-Dev-Secret-Key-2024-Very-Long-For-Security!"));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new Claim(JwtRegisteredClaimNames.Name, user.DisplayName),
            new Claim("tenant_id", tenantId),
            new Claim("role", user.RoleCode.ToString()),
            new Claim("department_id", user.DepartmentId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"] ?? "CityCommunicationCenter",
            audience: _configuration["Jwt:Audience"] ?? "CityCommunicationCenter",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class AuthResult
{
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
}
