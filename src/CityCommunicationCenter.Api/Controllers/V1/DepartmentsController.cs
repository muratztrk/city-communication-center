using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/organizations/departments")]
public sealed class DepartmentsController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public DepartmentsController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType<IEnumerable<DepartmentResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<DepartmentResponse>>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var departments = await _dbContext.Departments
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var response = departments
            .OrderBy(x => x.Name)
            .Select(x => new DepartmentResponse(
                x.DepartmentId,
                x.TenantId,
                x.Name,
                x.DepartmentType,
                x.ParentDepartmentId,
                x.ManagerUserId))
            .ToList();

        return Ok(response);
    }

    [HttpPost]
    [ProducesResponseType<DepartmentResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<DepartmentResponse>> Create(
        [FromBody] CreateDepartmentRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var entity = new Department
        {
            DepartmentId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Name = request.Name,
            DepartmentType = request.DepartmentType,
            ParentDepartmentId = request.ParentDepartmentId,
            ManagerUserId = request.ManagerUserId,
            CreatedByUserId = CurrentContext.UserId
        };

        await _dbContext.InsertDepartmentAsync(entity, cancellationToken);
        await _dbContext.InsertAuditLogAsync(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            EntityType = nameof(Department),
            EntityId = entity.DepartmentId.ToString(),
            Action = "DepartmentCreated",
            ActorUserId = CurrentContext.UserId,
            Details = $"Department '{entity.Name}' created."
        }, cancellationToken);

        var response = new DepartmentResponse(
            entity.DepartmentId,
            entity.TenantId,
            entity.Name,
            entity.DepartmentType,
            entity.ParentDepartmentId,
            entity.ManagerUserId);

        return CreatedAtAction(nameof(GetAll), response);
    }
}
