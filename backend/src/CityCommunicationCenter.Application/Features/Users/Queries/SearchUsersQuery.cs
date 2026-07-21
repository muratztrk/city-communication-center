namespace CityCommunicationCenter.Application.Features.Users;

public sealed record SearchUsersQuery(
    string? Query,
    Guid? DepartmentId,
    /// <summary>true ise yalnız DisplayName eşleşir (Personel Dahili No ara — card #1780).</summary>
    bool DisplayNameOnly = false) : IQuery<IReadOnlyList<UserLookupResponse>>;

public sealed class SearchUsersQueryHandler : IQueryHandler<SearchUsersQuery, IReadOnlyList<UserLookupResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public SearchUsersQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<UserLookupResponse>> Handle(SearchUsersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var normalizedQuery = request.Query?.Trim();
        var normalizedQueryUpper = normalizedQuery?.ToUpperInvariant();
        var requestedDepartmentName = request.DepartmentId.HasValue
            ? await _dbContext.Departments
                .AsNoTracking()
                .Where(entity => entity.TenantId == tenantId && entity.DepartmentId == request.DepartmentId.Value)
                .Select(entity => entity.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var query = _dbContext.Users
            .Where(entity => entity.TenantId == tenantId && entity.IsActive)
            .Join(
                _dbContext.Departments,
                user => user.DepartmentId,
                department => department.DepartmentId,
                (user, department) => new { User = user, Department = department });

        if (request.DepartmentId.HasValue)
        {
            query = query.Where(item =>
                item.User.DepartmentId == request.DepartmentId.Value ||
                _dbContext.UserDepartmentAssignments.Any(assignment =>
                    assignment.TenantId == tenantId &&
                    assignment.UserId == item.User.UserId &&
                    assignment.DepartmentId == request.DepartmentId.Value) ||
                _dbContext.Departments.Any(department =>
                    department.TenantId == tenantId &&
                    department.DepartmentId == request.DepartmentId.Value &&
                    department.ManagerUserId == item.User.UserId));
        }

        if (!string.IsNullOrWhiteSpace(normalizedQueryUpper))
        {
            if (request.DisplayNameOnly)
            {
                query = query.Where(item => item.User.DisplayName.ToUpper().Contains(normalizedQueryUpper));
            }
            else
            {
                query = query.Where(item =>
                    item.User.DisplayName.ToUpper().Contains(normalizedQueryUpper) ||
                    (item.User.Email != null && item.User.Email.ToUpper().Contains(normalizedQueryUpper)) ||
                    (item.User.Username != null && item.User.Username.ToUpper().Contains(normalizedQueryUpper)));
            }
        }

        return await query
            .OrderBy(item => item.User.DisplayName)
            .Take(15)
            .Select(item => new UserLookupResponse(
                item.User.UserId,
                request.DepartmentId ?? item.User.DepartmentId,
                requestedDepartmentName ?? item.Department.Name,
                item.User.DisplayName,
                item.User.Email,
                item.User.RoleCode.ToString(),
                item.User.IsActive,
                item.User.UserSource.ToString(),
                item.User.Title,
                item.User.Phone))
            .ToListAsync(cancellationToken);
    }
}
