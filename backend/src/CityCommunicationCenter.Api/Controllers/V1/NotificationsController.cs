using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Notifications;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/notifications")]
[TenantRequired]
public sealed class NotificationsController : ApiControllerBase
{
    private readonly ISender _sender;

    public NotificationsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<NotificationResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<NotificationResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetNotificationsQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("test")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> SendTest(
        [FromBody] TestNotificationRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new SendTestNotificationCommand(CurrentContext.UserId, request.Channel, request.Recipient, request.Message),
            cancellationToken);
        return Accepted(response);
    }

    [HttpPut("preferences")]
    public IActionResult UpdatePreferences([FromBody] UpdateNotificationPreferencesRequest request)
    {
        return Ok(new
        {
            message = "Notification preferences update contract accepted.",
            request.EmailEnabled,
            request.SmsEnabled,
            request.InAppEnabled
        });
    }
}
