using CityCommunicationCenter.Application.Features.CitizenMessageApprovals.Commands;
using CityCommunicationCenter.Application.Features.CitizenMessageApprovals.Queries;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/citizen-message-approvals")]
[TenantRequired]
public sealed class CitizenMessageApprovalsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public CitizenMessageApprovalsController(IMediator sender) { _sender = sender; }

    [HttpGet("")]
    public async Task<ActionResult<IEnumerable<CitizenMessageApprovalResponse>>> GetAll(
        [FromQuery] string? scope,
        CancellationToken cancellationToken)
        => Ok(await _sender.Send(new GetCitizenMessageApprovalsQuery(scope), cancellationToken));

    [HttpPost("{jobId:guid}/note")]
    public async Task<IActionResult> EditNote(
        Guid jobId,
        [FromBody] EditCitizenMessageApprovalNoteRequest request,
        CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(
            new EditCitizenMessageApprovalNoteCommand(jobId, CurrentContext.UserId, request.Note),
            cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/release")]
    public async Task<IActionResult> Release(Guid jobId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(
            new ReleaseCitizenMessageApprovalCommand(jobId, CurrentContext.UserId),
            cancellationToken);
        return ok ? NoContent() : NotFound();
    }
}
