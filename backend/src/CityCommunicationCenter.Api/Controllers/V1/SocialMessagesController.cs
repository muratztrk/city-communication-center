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
    [HttpPost("{messageId:guid}/convert-to-job")]
    public async Task<ActionResult<JobSummaryResponse>> ConvertToJob(
        Guid messageId,
        [FromBody] ConvertSocialMessageToJobRequest request,
        CancellationToken cancellationToken)
    {
        var job = await _sender.Send(
            new ConvertSocialMessageToJobCommand(
                messageId,
                CurrentContext.UserId,
                request.Title,
                request.Description,
                request.OwnerDepartmentId,
                request.Priority,
                request.DueDateUtc),
            cancellationToken);
        if (job is null) return NotFound();

        return CreatedAtAction(
            nameof(JobsController.GetById),
            "Jobs",
            new { jobId = job.JobId },
            job);
    }

    [HttpDelete("{messageId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid messageId, CancellationToken cancellationToken)
    {
        var deleted = await _sender.Send(
            new DeleteSocialMessageCommand(messageId, CurrentContext.TenantId!.Value),
            cancellationToken);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
