using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Services;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

/// <summary>
/// Admin API for managing auto-routing rules.
/// </summary>
[Route("api/v1/admin/routing")]
public sealed class RoutingController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly IRoutingService _routingService;

    public RoutingController(
        CityCommunicationCenterDbContext dbContext,
        IRoutingService routingService,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
        _routingService = routingService;
    }

    /// <summary>
    /// Get routing configuration including enabled status and all rules.
    /// </summary>
    [HttpGet]
    [ProducesResponseType<RoutingConfigResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<RoutingConfigResponse>> GetConfig(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var isEnabled = await _routingService.IsAutoRoutingEnabledAsync(tenantId.Value, cancellationToken);
        
        var rules = await _dbContext.RoutingRules
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var departments = await _dbContext.Departments
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var deptLookup = departments.ToDictionary(d => d.DepartmentId, d => d.Name);

        var ruleResponses = rules
            .OrderByDescending(r => r.Priority)
            .Select(r => new RoutingRuleResponse(
                r.RuleId,
                r.RuleName,
                r.Keywords,
                r.TargetDepartmentId,
                deptLookup.GetValueOrDefault(r.TargetDepartmentId, "Bilinmeyen"),
                r.Priority,
                r.IsActive))
            .ToList();

        return Ok(new RoutingConfigResponse(isEnabled, ruleResponses));
    }

    /// <summary>
    /// Enable or disable auto-routing.
    /// </summary>
    [HttpPost("toggle")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ToggleAutoRouting([FromBody] ToggleAutoRoutingRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        await _routingService.SetAutoRoutingEnabledAsync(tenantId.Value, request.Enabled, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Create a new routing rule.
    /// </summary>
    [HttpPost("rules")]
    [ProducesResponseType<RoutingRuleResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<RoutingRuleResponse>> CreateRule([FromBody] CreateRoutingRuleRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var rule = new RoutingRule
        {
            RuleId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            RuleName = request.RuleName,
            Keywords = request.Keywords,
            TargetDepartmentId = request.TargetDepartmentId,
            Priority = request.Priority,
            IsActive = true
        };

        await _dbContext.InsertRoutingRuleAsync(rule, cancellationToken);

        var dept = await _dbContext.Departments
            .WhereId("DepartmentId", rule.TargetDepartmentId)
            .FirstOrDefaultAsync(cancellationToken);

        return CreatedAtAction(nameof(GetConfig), new RoutingRuleResponse(
            rule.RuleId,
            rule.RuleName,
            rule.Keywords,
            rule.TargetDepartmentId,
            dept?.Name ?? "Bilinmeyen",
            rule.Priority,
            rule.IsActive));
    }

    /// <summary>
    /// Update an existing routing rule.
    /// </summary>
    [HttpPut("rules/{ruleId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRule(Guid ruleId, [FromBody] UpdateRoutingRuleRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var existing = await _dbContext.RoutingRules
            .WhereTenant(tenantId.Value)
            .WhereId("RuleId", ruleId)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is null)
        {
            return NotFound();
        }

        existing.RuleName = request.RuleName;
        existing.Keywords = request.Keywords;
        existing.TargetDepartmentId = request.TargetDepartmentId;
        existing.Priority = request.Priority;
        existing.IsActive = request.IsActive;

        await _dbContext.UpdateRoutingRuleAsync(existing, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Delete a routing rule.
    /// </summary>
    [HttpDelete("rules/{ruleId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRule(Guid ruleId, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var existing = await _dbContext.RoutingRules
            .WhereTenant(tenantId.Value)
            .WhereId("RuleId", ruleId)
            .FirstOrDefaultAsync(cancellationToken);

        if (existing is null)
        {
            return NotFound();
        }

        await _dbContext.DeleteRoutingRuleAsync(ruleId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Test routing for a message content.
    /// </summary>
    [HttpPost("test")]
    [ProducesResponseType<RoutingTestResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<RoutingTestResponse>> TestRouting([FromBody] RoutingTestRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var departmentId = await _routingService.GetTargetDepartmentAsync(tenantId.Value, request.MessageContent, cancellationToken);
        
        string? departmentName = null;
        if (departmentId.HasValue)
        {
            var dept = await _dbContext.Departments
                .WhereId("DepartmentId", departmentId.Value)
                .FirstOrDefaultAsync(cancellationToken);
            departmentName = dept?.Name;
        }

        return Ok(new RoutingTestResponse(departmentId, departmentName));
    }
}

public record RoutingConfigResponse(bool AutoRoutingEnabled, List<RoutingRuleResponse> Rules);

public record RoutingRuleResponse(
    Guid RuleId,
    string RuleName,
    string Keywords,
    Guid TargetDepartmentId,
    string TargetDepartmentName,
    int Priority,
    bool IsActive);

public record ToggleAutoRoutingRequest(bool Enabled);

public record CreateRoutingRuleRequest(
    string RuleName,
    string Keywords,
    Guid TargetDepartmentId,
    int Priority);

public record UpdateRoutingRuleRequest(
    string RuleName,
    string Keywords,
    Guid TargetDepartmentId,
    int Priority,
    bool IsActive);

public record RoutingTestRequest(string MessageContent);

public record RoutingTestResponse(Guid? TargetDepartmentId, string? TargetDepartmentName);
