using CityCommunicationCenter.Application.Features.EDevlet;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/edevlet")]
[TenantRequired]
public sealed class EDevletController : ApiControllerBase
{
    private readonly IMediator _sender;

    public EDevletController(IMediator sender) => _sender = sender;

    [HttpGet("activity-types")]
    [ProducesResponseType<IEnumerable<EDevletActivityTypeResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<EDevletActivityTypeResponse>>> GetActivityTypes(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetEDevletActivityTypesQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("activity-types")]
    [ProducesResponseType<EDevletActivityTypeResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<EDevletActivityTypeResponse>> CreateActivityType(
        [FromBody] CreateEDevletActivityTypeRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new CreateEDevletActivityTypeCommand(request.Name), cancellationToken);
        return CreatedAtAction(nameof(GetActivityTypes), response);
    }

    [HttpPut("activity-types/{activityTypeId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateActivityType(
        Guid activityTypeId,
        [FromBody] UpdateEDevletActivityTypeRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(new UpdateEDevletActivityTypeCommand(activityTypeId, request.Name), cancellationToken);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("activity-types/{activityTypeId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteActivityType(Guid activityTypeId, CancellationToken cancellationToken)
    {
        var deleted = await _sender.Send(new DeleteEDevletActivityTypeCommand(activityTypeId), cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("daily-plans")]
    [ProducesResponseType<EDevletDailyActivityPlanResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<EDevletDailyActivityPlanResponse>> CreateDailyPlan(
        [FromBody] CreateEDevletDailyActivityPlanRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new CreateEDevletDailyActivityPlanCommand(
                request.ActivityTypeId,
                request.Description,
                request.Neighborhood,
                request.Street,
                request.OpenAddress),
            cancellationToken);
        return Created(string.Empty, response);
    }
}
