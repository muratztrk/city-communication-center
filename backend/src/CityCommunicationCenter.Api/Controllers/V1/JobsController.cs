using CityCommunicationCenter.Application.Features.AuditLogs;
using CityCommunicationCenter.Application.Features.Jobs;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/jobs")]
[TenantRequired]
public sealed class JobsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public JobsController(IMediator sender) { _sender = sender; }

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
            request.OwnerUserIds,
            request.Priority,
            request.RequestType,
            request.IsProject,
            request.CitizenName,
            request.CitizenPhone,
            request.StartDateUtc,
            request.DueDateUtc,
            request.TargetDepartmentIds,
            request.SourceType,
            request.SourceRefId,
            request.Latitude,
            request.Longitude), cancellationToken);
        return CreatedAtRoute("GetJobById", new { jobId = response.JobId }, response);
    }

    [HttpPost("{jobId:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid jobId, [FromBody] CancelJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new CancelJobCommand(jobId, CurrentContext.UserId, request.Reason), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/return")]
    public async Task<IActionResult> Return(Guid jobId, [FromBody] CancelJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ReturnJobCommand(jobId, CurrentContext.UserId, request.Reason), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/owner-approval/approve")]
    public async Task<IActionResult> ApproveOwner(Guid jobId, [FromBody] JobApprovalDecisionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ApproveJobOwnerCommand(jobId, CurrentContext.UserId, request.Comment), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{jobId:guid}/owner-approval/reject")]
    public async Task<IActionResult> RejectOwner(Guid jobId, [FromBody] RejectJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new RejectJobOwnerCommand(jobId, CurrentContext.UserId, request.Reason), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPut("{jobId:guid}")]
    public async Task<IActionResult> Update(Guid jobId, [FromBody] UpdateJobRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new UpdateJobCommand(jobId, CurrentContext.UserId, request.Title, request.Description, request.Priority, request.StartDateUtc, request.DueDateUtc, request.Latitude, request.Longitude), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpDelete("{jobId:guid}")]
    public async Task<IActionResult> Delete(Guid jobId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new DeleteJobCommand(jobId, CurrentContext.UserId), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("{jobId:guid}/audit-log")]
    public async Task<ActionResult<IEnumerable<EntityAuditLogEntryResponse>>> GetJobAuditLog(Guid jobId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetEntityAuditLogQuery(RequiredTenantId, nameof(Job), jobId), cancellationToken);
        return Ok(result);
    }
}
