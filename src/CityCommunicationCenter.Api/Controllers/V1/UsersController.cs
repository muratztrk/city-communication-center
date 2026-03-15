using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/users")]
public sealed class UsersController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public UsersController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType<IEnumerable<UserSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<UserSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var users = await _dbContext.Users
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var response = users
            .OrderBy(x => x.DisplayName)
            .Select(x => new UserSummaryResponse(
                x.UserId,
                x.TenantId,
                x.DepartmentId,
                x.DisplayName,
                x.Email,
                x.RoleCode.ToString(),
                x.IsActive))
            .ToList();

        return Ok(response);
    }

    [HttpPost("sync/ad")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> SyncFromDirectory(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        await _dbContext.InsertAuditLogAsync(new Domain.Entities.AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            EntityType = "DirectorySync",
            EntityId = tenantId.Value.ToString(),
            Action = "DirectorySyncRequested",
            ActorUserId = CurrentContext.UserId,
            Details = "AD/LDAP synchronization request queued."
        }, cancellationToken);

        return Accepted(new { message = "Directory synchronization request recorded." });
    }
}
