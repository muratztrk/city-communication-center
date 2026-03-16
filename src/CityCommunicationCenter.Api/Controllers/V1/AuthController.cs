using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using CityCommunicationCenter.Api.Services;
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
}
