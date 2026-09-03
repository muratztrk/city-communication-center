using CityCommunicationCenter.Application.Features.Support;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/support-requests")]
[TenantRequired]
public sealed class SupportController : ApiControllerBase
{
    private readonly IMediator _sender;

    public SupportController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpPost("")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Submit(
        [FromBody] SubmitSupportRequestRequest request,
        CancellationToken cancellationToken)
    {
        var supportRequestId = await _sender.Send(
            new SubmitSupportRequestCommand(request.Subject, request.Message, request.PageContext),
            cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new { supportRequestId });
    }
}

public sealed record SubmitSupportRequestRequest(string Subject, string Message, string? PageContext);
