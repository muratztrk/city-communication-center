using CityCommunicationCenter.Application.Features.InternalMessages;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/internal-messages")]
[TenantRequired]
public sealed class InternalMessagesController : ApiControllerBase
{
    private readonly IMediator _sender;

    public InternalMessagesController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("conversations")]
    [ProducesResponseType<IEnumerable<InternalConversationSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<InternalConversationSummaryResponse>>> GetConversations(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetInternalConversationsQuery(CurrentContext.UserId), cancellationToken);
        return Ok(response);
    }

    [HttpGet("conversations/with/{otherUserId:guid}")]
    [ProducesResponseType<InternalConversationDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<InternalConversationDetailResponse>> GetConversationWithUser(
        Guid otherUserId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetInternalConversationWithUserQuery(otherUserId, CurrentContext.UserId), cancellationToken);
        if (response is null) return NotFound();
        return Ok(response);
    }

    [HttpPost("messages")]
    [ProducesResponseType<SendInternalMessageResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SendInternalMessageResponse>> SendMessage(
        [FromBody] SendInternalMessageRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new SendInternalMessageCommand(request.RecipientUserId, CurrentContext.UserId, request.Content),
            cancellationToken);
        if (response is null) return NotFound();
        return CreatedAtAction(nameof(GetConversationWithUser), new { otherUserId = request.RecipientUserId }, response);
    }

    [HttpPost("conversations/{internalConversationId:guid}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkRead(Guid internalConversationId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new MarkInternalConversationReadCommand(internalConversationId, CurrentContext.UserId), cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }
}
