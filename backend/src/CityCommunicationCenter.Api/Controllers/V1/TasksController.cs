using CityCommunicationCenter.Application.Features.Tasks;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/tasks")]
[TenantRequired]
public sealed class TasksController : ApiControllerBase
{
    private readonly IMediator _sender;

    public TasksController(IMediator sender) { _sender = sender; }

    [HttpGet("")]
    public async Task<ActionResult<IEnumerable<TaskSummaryResponse>>> GetAll([FromQuery] string? scope, CancellationToken cancellationToken)
        => Ok(await _sender.Send(new GetTasksQuery(scope), cancellationToken));

    [HttpGet("{taskId:guid}", Name = "GetTaskById")]
    public async Task<ActionResult<TaskDetailResponse>> GetById(Guid taskId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetTaskByIdQuery(taskId), cancellationToken);
        if (response is null) return NotFound();
        return Ok(response);
    }

    [HttpPost("")]
    public async Task<ActionResult<TaskSummaryResponse>> Create([FromBody] CreateTaskRequest request, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new CreateTaskCommand(
            CurrentContext.UserId,
            request.JobId,
            request.Title,
            request.Description,
            request.Priority,
            request.StartDateUtc,
            request.DueDateUtc,
            request.EstimatedHours,
            request.Notes,
            request.AssignedDepartmentId,
            request.AssignedUserId), cancellationToken);
        return CreatedAtRoute("GetTaskById", new { taskId = response.TaskId }, response);
    }

    [HttpPost("{taskId:guid}/assign")]
    public async Task<IActionResult> Assign(Guid taskId, [FromBody] AssignTaskRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new AssignTaskCommand(taskId, CurrentContext.UserId, request.DepartmentId, request.UserId), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/claim")]
    public async Task<IActionResult> Claim(Guid taskId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ClaimTaskFromPoolCommand(taskId, CurrentContext.UserId), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/complete")]
    public async Task<IActionResult> Complete(Guid taskId, [FromBody] CompleteTaskRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new CompleteTaskCommand(taskId, CurrentContext.UserId, request.ResultNote, request.ActualHours), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/approve-close")]
    public async Task<IActionResult> ApproveClose(Guid taskId, [FromBody] ApprovalActionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ApproveTaskCloseCommand(taskId, CurrentContext.UserId, request.Comment), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/reject-close")]
    public async Task<IActionResult> RejectClose(Guid taskId, [FromBody] ApprovalActionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new RejectTaskCloseCommand(taskId, CurrentContext.UserId, request.Comment), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/request-revision")]
    public async Task<IActionResult> RequestRevision(Guid taskId, [FromBody] RequestTaskRevisionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new RequestTaskRevisionCommand(taskId, CurrentContext.UserId, request.Reason, request.ProposedDueDateUtc), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/approve-revision")]
    public async Task<IActionResult> ApproveRevision(Guid taskId, [FromBody] RequestTaskRevisionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new ApproveTaskRevisionCommand(taskId, CurrentContext.UserId, request.Reason, request.ProposedDueDateUtc), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/reject-revision")]
    public async Task<IActionResult> RejectRevision(Guid taskId, [FromBody] ApprovalActionRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new RejectTaskRevisionCommand(taskId, CurrentContext.UserId, request.Comment), cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("{taskId:guid}/progress")]
    public async Task<IActionResult> UpdateProgress(Guid taskId, [FromBody] UpdateTaskProgressRequest request, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new UpdateTaskProgressCommand(taskId, CurrentContext.UserId, request.CompletionPercentage, request.ActualHours, request.Notes), cancellationToken);
        return ok ? NoContent() : NotFound();
    }
}
