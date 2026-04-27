using CityCommunicationCenter.Application.Features.Departments;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/departments")]
[Route("api/v1/organizations/departments")]
[TenantRequired]
public sealed class DepartmentsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public DepartmentsController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<DepartmentResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<DepartmentResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetDepartmentsQuery(), cancellationToken);

        return Ok(response);
    }

    [HttpPost("")]
    [ProducesResponseType<DepartmentResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<DepartmentResponse>> Create(
        [FromBody] CreateDepartmentRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new CreateDepartmentCommand(
                RequiredTenantId,
                CurrentContext.UserId,
                request.Name,
                request.DepartmentType,
                request.ParentDepartmentId,
                request.ManagerUserId,
                request.DeputyManagerUserId,
                request.ResponsibleUserIds),
            cancellationToken);

        return CreatedAtAction(nameof(GetAll), response);
    }

    [HttpPut("{departmentId:guid}")]
    [ProducesResponseType<DepartmentResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<DepartmentResponse>> Update(
        Guid departmentId,
        [FromBody] UpdateDepartmentRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new UpdateDepartmentCommand(
                CurrentContext.UserId,
                departmentId,
                request.Name,
                request.DepartmentType,
                request.ManagerUserId,
                request.DeputyManagerUserId,
                request.ResponsibleUserIds),
            cancellationToken);

        return Ok(response);
    }

    [HttpDelete("{departmentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(
        Guid departmentId,
        CancellationToken cancellationToken)
    {
        await _sender.Send(new DeleteDepartmentCommand(departmentId), cancellationToken);

        return NoContent();
    }
}
