using CityCommunicationCenter.Application.Features.IzmirCbs;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/izmir-cbs")]
[TenantRequired]
public sealed class IzmirCbsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public IzmirCbsController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("neighborhoods")]
    [ProducesResponseType<IReadOnlyList<IzmirCbsOptionResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<IzmirCbsOptionResponse>>> GetNeighborhoods(
        [FromQuery] string districtId,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetIzmirCbsNeighborhoodsQuery(districtId ?? string.Empty), cancellationToken);
        return Ok(response);
    }

    [HttpGet("streets")]
    [ProducesResponseType<IReadOnlyList<IzmirCbsOptionResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<IzmirCbsOptionResponse>>> GetStreets(
        [FromQuery] string neighborhoodId,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetIzmirCbsStreetsQuery(neighborhoodId ?? string.Empty), cancellationToken);
        return Ok(response);
    }

    [HttpGet("door-numbers")]
    [ProducesResponseType<IReadOnlyList<IzmirCbsOptionResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<IzmirCbsOptionResponse>>> GetDoorNumbers(
        [FromQuery] string streetId,
        [FromQuery] string neighborhoodId,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new GetIzmirCbsDoorNumbersQuery(streetId ?? string.Empty, neighborhoodId ?? string.Empty),
            cancellationToken);
        return Ok(response);
    }
}
