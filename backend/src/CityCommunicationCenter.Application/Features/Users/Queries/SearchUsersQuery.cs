namespace CityCommunicationCenter.Application.Features.Users;

public sealed record SearchUsersQuery(string? Query, Guid? DepartmentId) : IQuery<IReadOnlyList<UserLookupResponse>>;

public sealed class SearchUsersQueryHandler : IRequestHandler<SearchUsersQuery, IReadOnlyList<UserLookupResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SearchUsersQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<IReadOnlyList<UserLookupResponse>> Handle(SearchUsersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var normalizedQuery = request.Query?.Trim();
        var normalizedQueryUpper = normalizedQuery?.ToUpperInvariant();

        var query = _dbContext.Users
            .Where(entity => entity.TenantId == tenantId && entity.IsActive)
            .Join(
                _dbContext.Departments,
                user => user.DepartmentId,
                department => department.DepartmentId,
                (user, department) => new { User = user, Department = department });

        if (request.DepartmentId.HasValue)
        {
            query = query.Where(item => item.User.DepartmentId == request.DepartmentId.Value);
        }

        if (!string.IsNullOrWhiteSpace(normalizedQueryUpper))
        {
            query = query.Where(item =>
                item.User.DisplayName.ToUpper().Contains(normalizedQueryUpper) ||
                (item.User.Email != null && item.User.Email.ToUpper().Contains(normalizedQueryUpper)) ||
                (item.User.Username != null && item.User.Username.ToUpper().Contains(normalizedQueryUpper)));
        }

        return await query
            .OrderBy(item => item.User.DisplayName)
            .Take(15)
            .Select(item => new UserLookupResponse(
                item.User.UserId,
                item.User.DepartmentId,
                item.Department.Name,
                item.User.DisplayName,
                item.User.Email,
                item.User.RoleCode.ToString(),
                item.User.IsActive,
                item.User.UserSource.ToString()))
            .ToListAsync(cancellationToken);
    }
}