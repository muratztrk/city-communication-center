using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/social/messages")]
[TenantRequired]
public sealed class SocialMessagesController : ApiControllerBase
{
    private readonly ISender _sender;

    public SocialMessagesController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<SocialMessageSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SocialMessageSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSocialMessagesQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("{messageId:guid}")]
    [ProducesResponseType<SocialMessageDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SocialMessageDetailResponse>> GetById(Guid messageId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSocialMessageByIdQuery(messageId), cancellationToken);
        if (response is null) return NotFound();
        return Ok(response);
    }

    [HttpPost("{messageId:guid}/categorize")]
    public async Task<IActionResult> Categorize(
        Guid messageId,
        [FromBody] CategorizeSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(
            new CategorizeSocialMessageCommand(messageId, CurrentContext.UserId, request.Category, request.Tags),
            cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{messageId:guid}/route")]
    public async Task<IActionResult> Route(
        Guid messageId,
        [FromBody] RouteSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(
            new RouteSocialMessageCommand(messageId, CurrentContext.UserId, request.DepartmentId, request.UserId),
            cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{messageId:guid}/convert")]
    [HttpPost("{messageId:guid}/convert-to-task")]
    [ProducesResponseType<TaskSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<TaskSummaryResponse>> ConvertToTask(
        Guid messageId,
        [FromBody] ConvertSocialMessageToTaskRequest request,
        CancellationToken cancellationToken)
    {
        var task = await _sender.Send(
            new ConvertSocialMessageToTaskCommand(
                messageId,
                CurrentContext.UserId,
                request.Title,
                request.Description,
                request.Priority,
                request.DueDateUtc),
            cancellationToken);
        if (task is null) return NotFound();

        return CreatedAtAction(
            nameof(TasksController.GetById),
            "Tasks",
            new { taskId = task.TaskId },
            task);
    }
}
