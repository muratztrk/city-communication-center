using CityCommunicationCenter.Application.Features.Projects;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/projects")]
[TenantRequired]
public sealed class ProjectsController : ApiControllerBase
{
    private readonly ISender _sender;

    public ProjectsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<ProjectSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<ProjectSummaryResponse>>> GetAll(
        [FromQuery] string? projectType,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetProjectsQuery(projectType), cancellationToken);
        return Ok(response);
    }

    [HttpGet("{projectId:guid}")]
    [ProducesResponseType<ProjectDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProjectDetailResponse>> GetById(Guid projectId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetProjectByIdQuery(projectId), cancellationToken);
        if (response is null)
        {
            return NotFound();
        }

        return Ok(response);
    }

    [HttpPost("coordinated")]
    [ProducesResponseType<ProjectSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<ProjectSummaryResponse>> CreateCoordinated(
        [FromBody] CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new CreateCoordinatedProjectCommand(
                CurrentContext.UserId,
                request.Title,
                request.Description,
                request.OwnerDepartmentId,
                request.DepartmentIds ?? new List<Guid>(),
                request.Stages),
            cancellationToken);

        return CreatedAtAction(nameof(GetById), new { projectId = response.ProjectId }, response);
    }

    [HttpPost("departments/{projectDepartmentId:guid}/approve")]
    public async Task<IActionResult> ApproveDepartmentJoin(Guid projectDepartmentId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new ApproveDepartmentJoinCommand(projectDepartmentId, CurrentContext.UserId), cancellationToken);
        return result ? NoContent() : NotFound();
    }

    [HttpPost("departments/{projectDepartmentId:guid}/reject")]
    public async Task<IActionResult> RejectDepartmentJoin(Guid projectDepartmentId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new RejectDepartmentJoinCommand(projectDepartmentId, CurrentContext.UserId), cancellationToken);
        return result ? NoContent() : NotFound();
    }

    [HttpPost("directorate")]
    [ProducesResponseType<ProjectSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<ProjectSummaryResponse>> CreateDirectorate(
        [FromBody] CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new CreateDirectorateProjectCommand(
                CurrentContext.UserId,
                request.Title,
                request.Description,
                request.OwnerDepartmentId,
                request.Stages),
            cancellationToken);

        return CreatedAtAction(nameof(GetById), new { projectId = response.ProjectId }, response);
    }

    [HttpPost("{projectId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid projectId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new ApproveDirectorateProjectCommand(projectId, CurrentContext.UserId), cancellationToken);
        return result ? NoContent() : NotFound();
    }

    [HttpPost("{projectId:guid}/reject")]
    public async Task<IActionResult> Reject(
        Guid projectId,
        [FromBody] ApproveProjectRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new RejectDirectorateProjectCommand(projectId, CurrentContext.UserId, request.Comment), cancellationToken);
        return result ? NoContent() : NotFound();
    }

    [HttpPut("{projectId:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid projectId,
        [FromBody] UpdateProjectStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new UpdateProjectStatusCommand(projectId, CurrentContext.UserId, request.Status), cancellationToken);
        return result ? NoContent() : NotFound();
    }

    [HttpPut("stages/{stageId:guid}/status")]
    public async Task<IActionResult> UpdateStageStatus(
        Guid stageId,
        [FromBody] UpdateStageStatusRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new UpdateStageStatusCommand(stageId, CurrentContext.UserId, request.Status), cancellationToken);
        return result ? NoContent() : NotFound();
    }

    [HttpPost("{projectId:guid}/members")]
    public async Task<IActionResult> AddMember(
        Guid projectId,
        [FromBody] AddProjectMemberRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new AddProjectMemberCommand(projectId, CurrentContext.UserId, request.UserId, request.DepartmentId),
            cancellationToken);
        return result ? Ok() : NotFound();
    }
}
