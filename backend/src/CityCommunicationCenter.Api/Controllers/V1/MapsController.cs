using CityCommunicationCenter.Application.Features.Maps;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/maps")]
[TenantRequired]
public sealed class MapsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public MapsController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("coordinates")]
    [ProducesResponseType<GoogleMapsCoordinatesResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<GoogleMapsCoordinatesResponse?>> ResolveCoordinates(
        [FromQuery] string url,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new ResolveGoogleMapsCoordinatesQuery(url ?? string.Empty), cancellationToken);
        return Ok(response);
    }
}
