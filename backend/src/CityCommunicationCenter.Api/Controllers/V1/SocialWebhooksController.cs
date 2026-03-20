using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/social/webhooks")]
[TenantRequired]
public sealed class SocialWebhooksController : ApiControllerBase
{
    private readonly ISender _sender;

    public SocialWebhooksController(ISender sender)
    {
        _sender = sender;
    }

    [HttpPost("{channel}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> Receive(
        string channel,
        [FromBody] SocialWebhookRequest request,
        CancellationToken cancellationToken)
    {
        var messageId = await _sender.Send(
            new ReceiveSocialWebhookCommand(channel, CurrentContext.UserId, request),
            cancellationToken);
        return Accepted(new { messageId });
    }
}
