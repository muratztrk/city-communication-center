using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Jobs;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/jobs")]
[TenantRequired]
public sealed class JobsController : ApiControllerBase
{
    private readonly ISender _sender;

    public JobsController(ISender sender) { _sender = sender; }

    [HttpGet("")]
    public async Task<ActionResult<IEnumerable<JobSummaryResponse>>> GetAll([FromQuery] string? scope, CancellationToken cancellationToken)
        => Ok(await _sender.Send(new GetJobsQuery(scope), cancellationToken));

    [HttpGet("{jobId:guid}", Name = "GetJobById")]
    public async Task<ActionResult<JobDetailResponse>> GetById(Guid jobId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetJobByIdQuery(jobId), cancellationToken);
        if (response is null) return NotFound();
        return Ok(response);
    }

    [HttpPost("")]
    public async Task<ActionResult<JobSummaryResponse>> Create([FromBody] CreateJobRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new CreateJobCommand(
            CurrentContext.UserId,
            request.Title,
            request.Description,
            request.OwnerDepartmentId,
            request.Priority,
            request.StartDateUtc,
            request.DueDateUtc,
            request.TargetDepartmentIds,
            request.SourceType,
            request.SourceRefId), cancellationToken);
        return CreatedAtRoute("GetJobById", new { jobId = response.JobId }, response);
    }

    [HttpPost("{jobId:guid}/approve-owner")]
    public async Task<IActionResult> ApproveOwner(Guid jobId, [FromBody] ApprovalActionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ApproveJobOwnerCommand(jobId, CurrentContext.UserId, request.Comment), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/reject-owner")]
    public async Task<IActionResult> RejectOwner(Guid jobId, [FromBody] CancelJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new RejectJobOwnerCommand(jobId, CurrentContext.UserId, request.Reason), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/approve-target/{departmentId:guid}")]
    public async Task<IActionResult> ApproveTarget(Guid jobId, Guid departmentId, [FromBody] ApprovalActionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ApproveJobTargetCommand(jobId, departmentId, CurrentContext.UserId, request.Comment), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/reject-target/{departmentId:guid}")]
    public async Task<IActionResult> RejectTarget(Guid jobId, Guid departmentId, [FromBody] CancelJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new RejectJobTargetCommand(jobId, departmentId, CurrentContext.UserId, request.Reason), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/support")]
    public async Task<IActionResult> AddSupport(Guid jobId, [FromBody] AddSupportDepartmentRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new AddSupportDepartmentCommand(jobId, request.DepartmentId, CurrentContext.UserId, request.Notes), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/approve-support/{departmentId:guid}")]
    public async Task<IActionResult> ApproveSupport(Guid jobId, Guid departmentId, [FromBody] ApprovalActionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ApproveJobTargetCommand(jobId, departmentId, CurrentContext.UserId, request.Comment), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/reject-support/{departmentId:guid}")]
    public async Task<IActionResult> RejectSupport(Guid jobId, Guid departmentId, [FromBody] CancelJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new RejectJobTargetCommand(jobId, departmentId, CurrentContext.UserId, request.Reason), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid jobId, [FromBody] CancelJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new CancelJobCommand(jobId, CurrentContext.UserId, request.Reason), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{jobId:guid}")]
    public async Task<IActionResult> Delete(Guid jobId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new DeleteJobCommand(jobId, CurrentContext.UserId), cancellationToken);
        return ok ? NoContent() : NotFound();
    }
}
