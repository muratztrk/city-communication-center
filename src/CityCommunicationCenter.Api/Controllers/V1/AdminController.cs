using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Api.Services;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/admin")]
public sealed class AdminController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public AdminController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpGet("tenants/{tenantId:guid}/settings")]
    public async Task<ActionResult<TenantSettingsResponse>> GetTenantSettings(Guid tenantId, CancellationToken cancellationToken)
    {
        var accessError = EnsureAdminAccess();
        if (accessError is not null)
        {
            return accessError;
        }

        if (!TryGetTenantId(out var contextTenantId, out var tenantError))
        {
            return tenantError;
        }

        if (contextTenantId.Value != tenantId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Tenant yetkisi doğrulanamadı." });
        }

        var settings = await _dbContext.TenantSettings
            .WhereTenant(tenantId)
            .FirstOrDefaultAsync(cancellationToken);

        if (settings is null)
        {
            return NotFound();
        }

        return Ok(new TenantSettingsResponse(
            settings.TenantId,
            settings.DisplayName,
            settings.Theme,
            settings.Domain,
            settings.DefaultSlaHours));
    }

    [HttpPut("tenants/{tenantId:guid}/settings")]
    public async Task<IActionResult> UpdateTenantSettings(
        Guid tenantId,
        [FromBody] UpdateTenantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var accessError = EnsureAdminAccess();
        if (accessError is not null)
        {
            return accessError;
        }

        if (!TryGetTenantId(out var contextTenantId, out var tenantError))
        {
            return tenantError;
        }

        if (contextTenantId.Value != tenantId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Tenant yetkisi doğrulanamadı." });
        }

        var settings = new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = tenantId,
            DisplayName = request.DisplayName,
            Theme = request.Theme,
            Domain = request.Domain,
            DefaultSlaHours = request.DefaultSlaHours,
            CreatedByUserId = CurrentContext.UserId
        };

        await _dbContext.UpsertTenantSettingAsync(settings, CurrentContext.UserId, cancellationToken);
        return NoContent();
    }

    [HttpPost("workflows/publish")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public IActionResult PublishWorkflow([FromBody] PublishWorkflowRequest request)
    {
        var accessError = EnsureAdminAccess();
        if (accessError is not null)
        {
            return accessError;
        }

        return Accepted(new
        {
            message = "Workflow publication contract accepted.",
            request.WorkflowName,
            request.Version,
            request.Description
        });
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<IEnumerable<AuditLogResponse>>> GetAuditLogs(CancellationToken cancellationToken)
    {
        var accessError = EnsureAdminAccess();
        if (accessError is not null)
        {
            return accessError;
        }

        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var logs = await _dbContext.AuditLogs
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var response = logs
            .OrderByDescending(x => x.EventTimeUtc)
            .Select(x => new AuditLogResponse(
                x.AuditLogId,
                x.TenantId,
                x.EntityType,
                x.EntityId,
                x.Action,
                x.ActorUserId,
                x.EventTimeUtc,
                x.Details))
            .ToList();

        return Ok(response);
    }

    [HttpGet("tenants/{tenantId:guid}/menu-visibility")]
    public async Task<ActionResult<MenuVisibilitySettingsResponse>> GetMenuVisibilitySettings(Guid tenantId, CancellationToken cancellationToken)
    {
        var accessError = EnsureAdminAccess();
        if (accessError is not null)
        {
            return accessError;
        }

        if (!TryGetTenantId(out var contextTenantId, out var tenantError))
        {
            return tenantError;
        }

        if (contextTenantId.Value != tenantId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Tenant yetkisi doğrulanamadı." });
        }

        var menuVisibilityRulesJson = await _dbContext.GetMenuVisibilityRulesJsonAsync(tenantId, cancellationToken);
        var rules = MenuVisibilityPolicy.Deserialize(menuVisibilityRulesJson);
        return Ok(new MenuVisibilitySettingsResponse(
            tenantId,
            rules,
            MenuVisibilityPolicy.GetSupportedMenuKeys(),
            MenuVisibilityPolicy.GetSupportedRoleCodes()));
    }

    [HttpPut("tenants/{tenantId:guid}/menu-visibility")]
    public async Task<IActionResult> UpdateMenuVisibilitySettings(
        Guid tenantId,
        [FromBody] UpdateMenuVisibilitySettingsRequest request,
        CancellationToken cancellationToken)
    {
        var accessError = EnsureAdminAccess();
        if (accessError is not null)
        {
            return accessError;
        }

        if (!TryGetTenantId(out var contextTenantId, out var tenantError))
        {
            return tenantError;
        }

        if (contextTenantId.Value != tenantId)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Tenant yetkisi doğrulanamadı." });
        }

        var serializedRules = MenuVisibilityPolicy.Serialize(request.Rules);
        await _dbContext.SetMenuVisibilityRulesJsonAsync(tenantId, serializedRules, CurrentContext.UserId, cancellationToken);
        return NoContent();
    }

    private ActionResult? EnsureAdminAccess()
    {
        if (!CurrentContext.IsAuthenticated)
        {
            return Unauthorized(new { error = "Bu işlem için oturum açmanız gerekiyor." });
        }

        if (!IsSystemAdminRole(CurrentContext.RoleCode))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Bu işlem için sistem yöneticisi yetkisi gereklidir." });
        }

        return null;
    }

    private static bool IsSystemAdminRole(string? roleCode)
    {
        if (string.IsNullOrWhiteSpace(roleCode))
        {
            return false;
        }

        var normalizedRole = new string(roleCode.Where(char.IsLetter).ToArray()).ToLowerInvariant();
        return normalizedRole == "systemadmin";
    }
}
