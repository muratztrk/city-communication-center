using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/citizen-conversations")]
[TenantRequired]
public sealed class CitizenConversationsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public CitizenConversationsController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IReadOnlyList<CitizenConversationSummaryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CitizenConversationSummaryDto>>> GetAll(
        [FromQuery] bool whatsAppOnly = false,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(
            new GetCitizenConversationsQuery(whatsAppOnly, from, to),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("{conversationId:guid}")]
    [ProducesResponseType<CitizenConversationDetailDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CitizenConversationDetailDto>> GetDetail(
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetCitizenConversationDetailQuery(conversationId), cancellationToken);
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpPost("{conversationId:guid}/mark-read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkRead(Guid conversationId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new MarkConversationReadCommand(conversationId), cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("{conversationId:guid}/mark-waiting-replied")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkWaitingReplied(Guid conversationId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new MarkConversationWaitingRepliedCommand(conversationId), cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("{conversationId:guid}/mark-pending-approval-cleared")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkPendingApprovalCleared(Guid conversationId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new MarkConversationPendingApprovalClearedCommand(conversationId), cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPut("{conversationId:guid}/profile")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProfile(
        Guid conversationId,
        [FromBody] UpdateCitizenConversationProfileRequest request,
        CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(
            new UpdateCitizenConversationProfileCommand(
                conversationId,
                request.CitizenName,
                request.CitizenPhone,
                request.Label,
                request.Neighborhood,
                request.Street,
                request.StreetNo,
                request.OpenAddress,
                request.AllowClear),
            cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("{conversationId:guid}/block")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Block(Guid conversationId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new SetConversationBlockedCommand(conversationId, true), cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("{conversationId:guid}/unblock")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unblock(Guid conversationId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new SetConversationBlockedCommand(conversationId, false), cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpGet("tags")]
    [ProducesResponseType<IReadOnlyList<RequestTagResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RequestTagResponse>>> GetTags(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetRequestTagsQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPost("tags")]
    [ProducesResponseType<RequestTagResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<RequestTagResponse>> CreateTag(
        [FromBody] RequestTagRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new CreateRequestTagCommand(request.Name), cancellationToken);
        return Ok(result);
    }

    [HttpDelete("tags/{tagId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteTag(Guid tagId, CancellationToken cancellationToken)
    {
        var deleted = await _sender.Send(new DeleteRequestTagCommand(tagId), cancellationToken);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
