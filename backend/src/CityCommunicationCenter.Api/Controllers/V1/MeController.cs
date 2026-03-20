using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Me;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/me")]
[TenantRequired]
public sealed class MeController : ApiControllerBase
{
    private readonly ISender _sender;

    public MeController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CurrentUserResponse>> Get(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetCurrentUserQuery(), cancellationToken);
        return Ok(response);
    }
}
