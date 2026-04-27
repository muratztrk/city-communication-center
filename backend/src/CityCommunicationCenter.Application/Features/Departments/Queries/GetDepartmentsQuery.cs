

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

        var departments = await _dbContext.Departments
            .AsNoTracking()
            .Where(department => department.TenantId == tenantId)
            .OrderBy(department => department.Name)
            .ToListAsync(cancellationToken);

        return departments.Select(DepartmentResponseFactory.Create).ToArray();
    }
}
