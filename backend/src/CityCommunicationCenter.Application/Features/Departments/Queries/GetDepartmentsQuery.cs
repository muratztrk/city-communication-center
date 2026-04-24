

namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record GetDepartmentsQuery() : IQuery<IReadOnlyList<DepartmentResponse>>;

public sealed class GetDepartmentsQueryHandler : IQueryHandler<GetDepartmentsQuery, IReadOnlyList<DepartmentResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDepartmentsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<DepartmentResponse>> Handle(GetDepartmentsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        return await _dbContext.Departments
            .AsNoTracking()
            .Where(department => department.TenantId == tenantId)
            .OrderBy(department => department.Name)
            .Select(department => new DepartmentResponse(
                department.DepartmentId,
                department.TenantId,
                department.Name,
                department.DepartmentType,
                department.ParentDepartmentId,
                department.ManagerUserId))
            .ToListAsync(cancellationToken);
    }
}