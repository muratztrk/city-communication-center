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

    [HttpGet("daily-plans")]
    [ProducesResponseType<IEnumerable<EDevletDailyActivityPlanListItemResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<EDevletDailyActivityPlanListItemResponse>>> GetDailyPlans(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetEDevletDailyActivityPlansQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("daily-plans/{planId:guid}")]
    [ProducesResponseType<EDevletDailyActivityPlanResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EDevletDailyActivityPlanResponse>> GetDailyPlan(Guid planId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetEDevletDailyActivityPlanByIdQuery(planId), cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPut("daily-plans/{planId:guid}")]
    [ProducesResponseType<EDevletDailyActivityPlanResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EDevletDailyActivityPlanResponse>> UpdateDailyPlan(
        Guid planId,
        [FromBody] UpdateEDevletDailyActivityPlanRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new UpdateEDevletDailyActivityPlanCommand(
                planId,
                request.ActivityTypeId,
                request.Description,
                request.Neighborhood,
                request.Street,
                request.OpenAddress),
            cancellationToken);
        return response is null ? NotFound() : Ok(response);
    }

    [HttpPost("daily-plans/{planId:guid}/cancel")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelDailyPlan(Guid planId, CancellationToken cancellationToken)
    {
        var cancelled = await _sender.Send(new CancelEDevletDailyActivityPlanCommand(planId), cancellationToken);
        return cancelled ? NoContent() : NotFound();
    }

    [HttpPost("daily-plans/{planId:guid}/duplicate")]
    [ProducesResponseType<EDevletDailyActivityPlanResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EDevletDailyActivityPlanResponse>> DuplicateDailyPlan(Guid planId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new DuplicateEDevletDailyActivityPlanCommand(planId), cancellationToken);
        return response is null ? NotFound() : Created(string.Empty, response);
    }
}
