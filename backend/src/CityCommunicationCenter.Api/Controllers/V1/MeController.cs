using CityCommunicationCenter.Application.Features.Me;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/me")]
[TenantRequired]
public sealed class MeController : ApiControllerBase
{
    private readonly IMediator _sender;

    public MeController(IMediator sender)
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

    [HttpGet("departments")]
    [ProducesResponseType<IReadOnlyList<DepartmentSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<DepartmentSummaryResponse>>> GetDepartments(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetMyDepartmentsQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("change-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangePassword(
        [FromBody] ChangeMyPasswordRequest request,
        CancellationToken cancellationToken)
    {
        await _sender.Send(
            new ChangeMyPasswordCommand(request.CurrentPassword, request.NewPassword, request.ConfirmPassword),
            cancellationToken);
        return NoContent();
    }

    [HttpGet("quick-replies")]
    [ProducesResponseType<IReadOnlyList<UserQuickReplyTemplateResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<UserQuickReplyTemplateResponse>>> GetQuickReplies(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetUserQuickReplyTemplatesQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("quick-replies")]
    [ProducesResponseType<UserQuickReplyTemplateResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserQuickReplyTemplateResponse>> CreateQuickReply(
        [FromBody] UserQuickReplyTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new SaveUserQuickReplyTemplateCommand(null, request.Name, request.Content),
            cancellationToken);
        return Ok(response);
    }

    [HttpPut("quick-replies/{templateId:guid}")]
    [ProducesResponseType<UserQuickReplyTemplateResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserQuickReplyTemplateResponse>> UpdateQuickReply(
        Guid templateId,
        [FromBody] UserQuickReplyTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new SaveUserQuickReplyTemplateCommand(templateId, request.Name, request.Content),
            cancellationToken);
        return Ok(response);
    }

    [HttpDelete("quick-replies/{templateId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteQuickReply(Guid templateId, CancellationToken cancellationToken)
    {
        var deleted = await _sender.Send(new DeleteUserQuickReplyTemplateCommand(templateId), cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}
