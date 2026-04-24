using CityCommunicationCenter.Application.Features.Routing;

namespace CityCommunicationCenter.Api.Controllers.V1;

/// <summary>
/// Admin API for managing auto-routing rules.
/// </summary>
[Route("api/v1/admin/routing")]
[TenantRequired]
[Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
public sealed class RoutingController : ApiControllerBase
{
    private readonly IMediator _sender;

    public RoutingController(IMediator sender)
    {
        _sender = sender;
    }

    /// <summary>
    /// Get routing configuration including enabled status and all rules.
    /// </summary>
    [HttpGet("")]
    [ProducesResponseType<RoutingConfigResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<RoutingConfigResponse>> GetConfig(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetRoutingConfigQuery(), cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Enable or disable auto-routing.
    /// </summary>
    [HttpPost("toggle")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ToggleAutoRouting([FromBody] ToggleAutoRoutingRequest request, CancellationToken cancellationToken)
    {
        await _sender.Send(new ToggleAutoRoutingCommand(request.Enabled), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Create a new routing rule.
    /// </summary>
    [HttpPost("rules")]
    [ProducesResponseType<RoutingRuleResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<RoutingRuleResponse>> CreateRule([FromBody] CreateRoutingRuleRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new CreateRoutingRuleCommand(request.RuleName, request.Keywords, request.TargetDepartmentId, request.Priority),
            cancellationToken);

        return CreatedAtAction(nameof(GetConfig), response);
    }

    /// <summary>
    /// Update an existing routing rule.
    /// </summary>
    [HttpPut("rules/{ruleId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRule(Guid ruleId, [FromBody] UpdateRoutingRuleRequest request, CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(
            new UpdateRoutingRuleCommand(ruleId, request.RuleName, request.Keywords, request.TargetDepartmentId, request.Priority, request.IsActive),
            cancellationToken);
        if (!updated) return NotFound();
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
        var deleted = await _sender.Send(new DeleteRoutingRuleCommand(ruleId), cancellationToken);
        if (!deleted) return NotFound();
        return NoContent();
    }

    /// <summary>
    /// Test routing for a message content.
    /// </summary>
    [HttpPost("test")]
    [ProducesResponseType<RoutingTestResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<RoutingTestResponse>> TestRouting([FromBody] RoutingTestRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new TestRoutingQuery(request.MessageContent), cancellationToken);
        return Ok(response);
    }
}
