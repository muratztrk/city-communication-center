using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/users")]
[TenantRequired]
public sealed class UsersController : ApiControllerBase
{
    private readonly IMediator _sender;

    public UsersController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<UserSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<UserSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetUsersQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("management-context")]
    [Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
    [ProducesResponseType<UserManagementContextResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserManagementContextResponse>> GetManagementContext(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetUserManagementContextQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpGet("search")]
    [ProducesResponseType<IEnumerable<UserLookupResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<UserLookupResponse>>> Search(
        [FromQuery] string? query,
        [FromQuery] Guid? departmentId,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new SearchUsersQuery(query, departmentId), cancellationToken);
        return Ok(response);
    }

    [HttpGet("directory-search")]
    [Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
    [ProducesResponseType<IEnumerable<DirectoryUserLookupResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<DirectoryUserLookupResponse>>> SearchDirectory(
        [FromQuery] string query,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new SearchDirectoryUsersQuery(query), cancellationToken);
        return Ok(response);
    }

    [HttpGet("directory-departments")]
    [Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
    [ProducesResponseType<IEnumerable<string>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<string>>> ListDirectoryDepartments(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new ListDirectoryDepartmentsQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("")]
    [Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
    [ProducesResponseType<UserSummaryResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<UserSummaryResponse>> Create(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new CreateUserCommand(
                request.Username,
                request.DisplayName,
                request.Email,
                request.Password,
                request.DepartmentId ?? Guid.Empty,
                request.AdditionalDepartmentIds,
                request.RoleCode,
                request.AdditionalRoleCodes,
                request.IsActive,
                request.SourceType,
                request.ExternalIdentityId,
                request.LdapDepartmentName),
            cancellationToken);

        return CreatedAtAction(nameof(GetAll), response);
    }

    [HttpPost("sync/ad")]
    [Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> SyncFromDirectory(CancellationToken cancellationToken)
    {
        var message = await _sender.Send(new SyncDirectoryCommand(), cancellationToken);
        return Accepted(new { message });
    }

    [HttpPut("{userId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
    [ProducesResponseType<UserSummaryResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<UserSummaryResponse>> Update(
        Guid userId,
        [FromBody] UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _sender.Send(
            new UpdateUserCommand(
                userId,
                request.DepartmentId,
                request.AdditionalDepartmentIds,
                request.RoleCode,
                request.AdditionalRoleCodes,
                request.IsActive,
                request.DisplayName,
                request.Email,
                request.Title),
            cancellationToken);

        return Ok(response);
    }

    [HttpDelete("{userId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.PlatformAdmin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid userId, CancellationToken cancellationToken)
    {
        await _sender.Send(new DeleteUserCommand(userId), cancellationToken);
        return NoContent();
    }
}
