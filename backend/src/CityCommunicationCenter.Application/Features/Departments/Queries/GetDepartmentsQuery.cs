

namespace CityCommunicationCenter.Application.Features.Departments;

public sealed record GetDepartmentsQuery(Guid TenantId) : IQuery<IReadOnlyList<DepartmentResponse>>;

public sealed class GetDepartmentsQueryHandler : IRequestHandler<GetDepartmentsQuery, IReadOnlyList<DepartmentResponse>>
{
    private readonly IApplicationDbContext _dbContext;

    public GetDepartmentsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<DepartmentResponse>> Handle(GetDepartmentsQuery request, CancellationToken cancellationToken)
    {
        return await _dbContext.Departments
            .Where(department => department.TenantId == request.TenantId)
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