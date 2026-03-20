using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/users")]
[TenantRequired]
public sealed class UsersController : ApiControllerBase
{
    private readonly ISender _sender;

    public UsersController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<UserSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<UserSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetUsersQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("sync/ad")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> SyncFromDirectory(CancellationToken cancellationToken)
    {
        var message = await _sender.Send(new SyncDirectoryCommand(), cancellationToken);
        return Accepted(new { message });
    }
}
