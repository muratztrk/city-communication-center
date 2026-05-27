using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetMyDepartmentsQuery() : IQuery<IReadOnlyList<DepartmentSummaryResponse>>;

public sealed class GetMyDepartmentsQueryHandler : IQueryHandler<GetMyDepartmentsQuery, IReadOnlyList<DepartmentSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetMyDepartmentsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<DepartmentSummaryResponse>> Handle(GetMyDepartmentsQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        if (!context.UserId.HasValue)
        {
            return [];
        }

        var userId = context.UserId.Value;

        var user = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (user is null)
        {
            return [];
        }

        return await UserDepartmentAccess.GetDepartmentSummariesAsync(_dbContext, tenantId, user, cancellationToken);
    }
}
