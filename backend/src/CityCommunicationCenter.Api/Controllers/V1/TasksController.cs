using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Tasks;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/tasks")]
[TenantRequired]
public sealed class TasksController : ApiControllerBase
{
    private readonly ISender _sender;

    public TasksController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<TaskSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<TaskSummaryResponse>>> GetAll(
        [FromQuery] string? scope,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetTasksQuery(scope), cancellationToken);
        return Ok(response);
    }

    [HttpGet("{taskId:guid}", Name = nameof(GetById))]
    [ProducesResponseType<TaskDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TaskDetailResponse>> GetById(Guid taskId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetTaskByIdQuery(taskId), cancellationToken);
        if (response is null)
        {
            return NotFound();
        }

        return Ok(response);
    }

    [HttpPost("")]
    [ProducesResponseType<TaskSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<TaskSummaryResponse>> Create(
        [FromBody] CreateTaskRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new CreateTaskCommand(
                CurrentContext.UserId,
                request.Title,
                request.Description,
                request.TaskType,
                request.SourceType,
                request.SourceRefId,
                request.TargetDepartmentId,
                request.Priority,
                request.DueDateUtc),
            cancellationToken);

        return CreatedAtRoute(nameof(GetById), new { taskId = response.TaskId }, response);
    }

    [HttpPost("{taskId:guid}/submit")]
    public async Task<IActionResult> Submit(Guid taskId, [FromBody] SubmitTaskRequest request, CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(new SubmitTaskCommand(taskId, CurrentContext.UserId, request.Note), cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{taskId:guid}/approve")]
    public async Task<IActionResult> Approve(
        Guid taskId,
        [FromBody] ApprovalActionRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(new ApproveTaskCommand(taskId, CurrentContext.UserId, request.Comment), cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{taskId:guid}/reject")]
    public async Task<IActionResult> Reject(
        Guid taskId,
        [FromBody] ApprovalActionRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(new RejectTaskCommand(taskId, CurrentContext.UserId, request.Comment), cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{taskId:guid}/assign")]
    public async Task<IActionResult> Assign(
        Guid taskId,
        [FromBody] AssignTaskRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(
            new AssignTaskCommand(taskId, CurrentContext.UserId, request.DepartmentId, request.UserId, request.ActionType),
            cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{taskId:guid}/claim")]
    public async Task<IActionResult> Claim(Guid taskId, CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(new ClaimTaskFromPoolCommand(taskId, CurrentContext.UserId), cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{taskId:guid}/complete")]
    public async Task<IActionResult> Complete(
        Guid taskId,
        [FromBody] CompleteTaskRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(new CompleteTaskCommand(taskId, CurrentContext.UserId, request.ResultNote), cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{taskId:guid}/close")]
    public async Task<IActionResult> Close(
        Guid taskId,
        [FromBody] CloseTaskRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(new CloseTaskCommand(taskId, CurrentContext.UserId, request.ClosureNote), cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }
}
