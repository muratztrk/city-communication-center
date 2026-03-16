using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.IdentityModel.Tokens;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Api.Services;

public class AuthService
{
    public const string DevelopmentPassword = "password123";

    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly IActiveDirectoryAuthenticationService _activeDirectoryAuthenticationService;
    private readonly ActiveDirectoryOptions _activeDirectoryOptions;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        CityCommunicationCenterDbContext dbContext,
        IConfiguration configuration,
        IActiveDirectoryAuthenticationService activeDirectoryAuthenticationService,
        IOptions<ActiveDirectoryOptions> activeDirectoryOptions,
        ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _activeDirectoryAuthenticationService = activeDirectoryAuthenticationService;
        _activeDirectoryOptions = activeDirectoryOptions.Value;
        _logger = logger;
    }

    public async Task<AuthResult?> AuthenticateAsync(string username, string password, string tenantId)
    {
        if (!Guid.TryParse(tenantId, out var parsedTenantId))
        {
            return null;
        }

        var normalizedUsername = username.Trim();
        DirectoryUserInfo? directoryUser = null;

        if (_activeDirectoryOptions.Enabled)
        {
            directoryUser = _activeDirectoryAuthenticationService.Authenticate(normalizedUsername, password);
            if (directoryUser is null)
            {
                return null;
            }
        }
        else
        {
            // Development-only fallback.
            if (password != DevelopmentPassword)
            {
                return null;
            }
        }

        var user = await ResolveApplicationUserAsync(parsedTenantId, normalizedUsername, directoryUser);
        if (user is null
            && _activeDirectoryOptions.Enabled
            && _activeDirectoryOptions.AutoProvisionUsers
            && directoryUser is not null)
        {
            user = await AutoProvisionUserAsync(parsedTenantId, directoryUser);
        }

        if (user is null)
        {
            return null;
        }

        if (!user.IsActive)
        {
            return null;
        }

        if (directoryUser is not null)
        {
            await _dbContext.UpdateUserDirectoryProfileAsync(
                user.UserId,
                directoryUser.ExternalId,
                directoryUser.Email,
                directoryUser.DisplayName);

            user.ExternalIdentityId = directoryUser.ExternalId;
            user.Email = !string.IsNullOrWhiteSpace(directoryUser.Email) ? directoryUser.Email : user.Email;
            user.DisplayName = !string.IsNullOrWhiteSpace(directoryUser.DisplayName)
                ? directoryUser.DisplayName
                : user.DisplayName;
        }

        // Get tenant name.
        var tenant = await _dbContext.Tenants
            .Where("TenantId = @TenantId", ("@TenantId", parsedTenantId))
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

    public bool IsActiveDirectoryEnabled => _activeDirectoryOptions.Enabled;

    private async Task<ApplicationUser?> ResolveApplicationUserAsync(
        Guid tenantId,
        string username,
        DirectoryUserInfo? directoryUser)
    {
        if (directoryUser is not null)
        {
            if (!string.IsNullOrWhiteSpace(directoryUser.ExternalId))
            {
                var byExternalId = await _dbContext.Users
                    .WhereTenant(tenantId)
                    .Where("ExternalIdentityId = @ExternalIdentityId", ("@ExternalIdentityId", directoryUser.ExternalId))
                    .FirstOrDefaultAsync();
                if (byExternalId is not null)
                {
                    return byExternalId;
                }
            }

            if (!string.IsNullOrWhiteSpace(directoryUser.Email))
            {
                var byEmail = await _dbContext.Users
                    .WhereTenant(tenantId)
                    .Where("Email = @Email", ("@Email", directoryUser.Email))
                    .FirstOrDefaultAsync();
                if (byEmail is not null)
                {
                    return byEmail;
                }
            }
        }

        if (username.Contains('@'))
        {
            var byUsernameAsEmail = await _dbContext.Users
                .WhereTenant(tenantId)
                .Where("Email = @Email", ("@Email", username))
                .FirstOrDefaultAsync();
            if (byUsernameAsEmail is not null)
            {
                return byUsernameAsEmail;
            }
        }

        return await _dbContext.Users
            .WhereTenant(tenantId)
            .Where("DisplayName = @DisplayName", ("@DisplayName", username))
            .FirstOrDefaultAsync();
    }

    private async Task<ApplicationUser?> AutoProvisionUserAsync(Guid tenantId, DirectoryUserInfo directoryUser)
    {
        var departments = await _dbContext.Departments
            .WhereTenant(tenantId)
            .ToListAsync();

        Guid? departmentId = null;
        if (Guid.TryParse(_activeDirectoryOptions.DefaultDepartmentId, out var configuredDepartmentId)
            && departments.Any(x => x.DepartmentId == configuredDepartmentId))
        {
            departmentId = configuredDepartmentId;
        }
        else
        {
            departmentId = departments
                .OrderBy(x => x.Name)
                .Select(x => (Guid?)x.DepartmentId)
                .FirstOrDefault();
        }

        if (!departmentId.HasValue)
        {
            _logger.LogWarning(
                "ActiveDirectory auto-provision is enabled but no department exists for tenant {TenantId}.",
                tenantId);
            return null;
        }

        var defaultRole = Enum.TryParse<RoleCode>(
            _activeDirectoryOptions.DefaultRoleCode,
            ignoreCase: true,
            out var parsedRole)
            ? parsedRole
            : RoleCode.Staff;

        var user = new ApplicationUser
        {
            UserId = Guid.NewGuid(),
            TenantId = tenantId,
            DepartmentId = departmentId.Value,
            DisplayName = !string.IsNullOrWhiteSpace(directoryUser.DisplayName)
                ? directoryUser.DisplayName
                : directoryUser.UserPrincipalName,
            Email = directoryUser.Email,
            ExternalIdentityId = directoryUser.ExternalId,
            RoleCode = defaultRole,
            IsActive = true
        };

        await _dbContext.InsertUserAsync(user);
        await _dbContext.InsertAuditLogAsync(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(ApplicationUser),
            EntityId = user.UserId.ToString(),
            Action = "UserAutoProvisionedFromActiveDirectory",
            ActorUserId = user.UserId,
            Details = $"User '{user.DisplayName}' was auto-provisioned from Active Directory."
        });

        return user;
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

public class BootstrapTenantRequest
{
    public string MunicipalityName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string AdminDisplayName { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
}

public class BootstrapTenantResponse
{
    public string TenantId { get; set; } = string.Empty;
    public string MunicipalityName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string AdminDisplayName { get; set; } = string.Empty;
    public string AdminEmail { get; set; } = string.Empty;
    public string TemporaryPassword { get; set; } = string.Empty;
    public string AuthMode { get; set; } = "Development";
}
