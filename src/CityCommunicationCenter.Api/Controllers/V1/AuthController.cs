using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CityCommunicationCenter.Api.Services;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
[Route("api/v1/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly CityCommunicationCenterDbContext _dbContext;

    public AuthController(AuthService authService, CityCommunicationCenterDbContext dbContext)
    {
        _authService = authService;
        _dbContext = dbContext;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Kullanıcı adı ve şifre gereklidir." });
        }

        if (string.IsNullOrWhiteSpace(request.TenantId))
        {
            return BadRequest(new { error = "Belediye seçimi gereklidir." });
        }

        var result = await _authService.AuthenticateAsync(request.Username, request.Password, request.TenantId);

        if (result == null)
        {
            return Unauthorized(new { error = "Geçersiz kullanıcı adı veya şifre." });
        }

        return Ok(result);
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult GetCurrentUser()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                     ?? User.FindFirst("sub")?.Value;
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                    ?? User.FindFirst("email")?.Value;
        var name = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
                   ?? User.FindFirst("name")?.Value;
        var role = User.FindFirst("role")?.Value;
        var tenantId = User.FindFirst("tenant_id")?.Value;
        var departmentId = User.FindFirst("department_id")?.Value;

        return Ok(new
        {
            userId,
            email,
            displayName = name,
            role,
            tenantId,
            departmentId
        });
    }

    [HttpGet("tenants")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> GetTenants()
    {
        var tenants = await _dbContext.Tenants.ToListAsync();
        return Ok(tenants.Select(t => new
        {
            t.TenantId,
            t.MunicipalityName,
            t.DisplayName
        }));
    }

    [HttpPost("bootstrap")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Bootstrap([FromBody] BootstrapTenantRequest request, CancellationToken cancellationToken)
    {
        var municipalityName = request.MunicipalityName?.Trim();
        if (string.IsNullOrWhiteSpace(municipalityName))
        {
            return BadRequest(new { error = "Belediye adı zorunludur." });
        }

        var adminDisplayName = request.AdminDisplayName?.Trim();
        if (string.IsNullOrWhiteSpace(adminDisplayName))
        {
            return BadRequest(new { error = "Yönetici adı zorunludur." });
        }

        var adminEmail = request.AdminEmail?.Trim();
        if (string.IsNullOrWhiteSpace(adminEmail))
        {
            return BadRequest(new { error = "Yönetici e-postası zorunludur." });
        }

        var displayName = string.IsNullOrWhiteSpace(request.DisplayName)
            ? municipalityName
            : request.DisplayName.Trim();

        var tenantId = Guid.NewGuid();
        var adminDepartmentId = Guid.NewGuid();
        var adminUserId = Guid.NewGuid();

        var tenant = new Tenant
        {
            TenantId = tenantId,
            MunicipalityName = municipalityName,
            DisplayName = displayName,
            DeploymentMode = DeploymentMode.DedicatedHosted,
            IsActive = true
        };

        var adminDepartment = new Department
        {
            DepartmentId = adminDepartmentId,
            TenantId = tenantId,
            Name = "Sistem Yönetimi",
            DepartmentType = "Administration",
            CreatedByUserId = adminUserId
        };

        var adminUser = new ApplicationUser
        {
            UserId = adminUserId,
            TenantId = tenantId,
            DepartmentId = adminDepartmentId,
            DisplayName = adminDisplayName,
            Email = adminEmail,
            RoleCode = RoleCode.SystemAdmin,
            IsActive = true,
            CreatedByUserId = adminUserId
        };

        var tenantSetting = new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = tenantId,
            DisplayName = displayName,
            DefaultSlaHours = 48,
            AutoRoutingEnabled = false,
            CreatedByUserId = adminUserId
        };

        var created = await _dbContext.TryBootstrapTenantAsync(
            tenant,
            adminDepartment,
            adminUser,
            tenantSetting,
            cancellationToken);

        if (!created)
        {
            return Conflict(new { error = "Kurulum zaten tamamlandı. Mevcut belediye kaydı kullanılmalıdır." });
        }

        var usingActiveDirectory = _authService.IsActiveDirectoryEnabled;
        return Ok(new BootstrapTenantResponse
        {
            TenantId = tenantId.ToString(),
            MunicipalityName = municipalityName,
            DisplayName = displayName,
            AdminDisplayName = adminDisplayName,
            AdminEmail = adminEmail,
            TemporaryPassword = usingActiveDirectory ? string.Empty : AuthService.DevelopmentPassword,
            AuthMode = usingActiveDirectory ? "ActiveDirectory" : "Development"
        });
    }
}
