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

        // Türkçe karakter / i-ı eşlemesi için adayları çekip bellekte katla (card #1791).
        var candidates = await query
            .OrderBy(item => item.User.DisplayName)
            .Select(item => new CandidateRow(
                item.User.UserId,
                request.DepartmentId ?? item.User.DepartmentId,
                requestedDepartmentName ?? item.Department.Name,
                item.User.DisplayName,
                item.User.Email,
                item.User.Username,
                item.User.RoleCode.ToString(),
                item.User.IsActive,
                item.User.UserSource.ToString(),
                item.User.Title,
                item.User.Phone))
            .ToListAsync(cancellationToken);

        IEnumerable<CandidateRow> filtered = candidates;
        if (!string.IsNullOrWhiteSpace(normalizedQuery))
        {
            filtered = request.DisplayNameOnly
                ? candidates.Where(item => TurkishText.ContainsFolded(item.DisplayName, normalizedQuery))
                : candidates.Where(item =>
                    TurkishText.ContainsFolded(item.DisplayName, normalizedQuery)
                    || TurkishText.ContainsFolded(item.Email, normalizedQuery)
                    || TurkishText.ContainsFolded(item.Username, normalizedQuery));
        }

        return filtered
            .Take(15)
            .Select(item => new UserLookupResponse(
                item.UserId,
                item.DepartmentId,
                item.DepartmentName,
                item.DisplayName,
                item.Email,
                item.RoleCode,
                item.IsActive,
                item.UserSource,
                item.Title,
                item.Phone))
            .ToList();
    }

    private sealed record CandidateRow(
        Guid UserId,
        Guid DepartmentId,
        string DepartmentName,
        string DisplayName,
        string? Email,
        string? Username,
        string RoleCode,
        bool IsActive,
        string UserSource,
        string? Title,
        string? Phone);
}
