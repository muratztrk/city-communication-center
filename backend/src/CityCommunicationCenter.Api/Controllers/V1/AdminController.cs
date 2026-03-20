using CityCommunicationCenter.Application.Features.Admin;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/admin")]
[TenantRequired]
[Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
public sealed class AdminController : ApiControllerBase
{
    private readonly ISender _sender;

    public AdminController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("tenants/{tenantId:guid}/settings")]
    public async Task<ActionResult<TenantSettingsResponse>> GetTenantSettings(Guid tenantId, CancellationToken cancellationToken)
    {
        var settings = await _sender.Send(new GetTenantSettingsQuery(tenantId), cancellationToken);

        if (settings is null)
        {
            return NotFound();
        }

        return Ok(settings);
    }

    [HttpPut("tenants/{tenantId:guid}/settings")]
    public async Task<IActionResult> UpdateTenantSettings(
        Guid tenantId,
        [FromBody] UpdateTenantSettingsRequest request,
        CancellationToken cancellationToken)
    {
        await _sender.Send(
            new UpdateTenantSettingsCommand(
                tenantId,
                CurrentContext.UserId,
                request.DisplayName,
                request.Theme,
                request.Domain,
                request.DefaultSlaHours),
            cancellationToken);
        return NoContent();
    }

    [HttpPost("workflows/publish")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> PublishWorkflow([FromBody] PublishWorkflowRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new PublishWorkflowCommand(request.WorkflowName, request.Version, request.Description),
            cancellationToken);

        return Accepted(response);
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<IEnumerable<AuditLogResponse>>> GetAuditLogs(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetAuditLogsQuery(RequiredTenantId), cancellationToken);
        return Ok(response);
    }
}
