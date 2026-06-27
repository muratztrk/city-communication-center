
namespace CityCommunicationCenter.Application.Features.Users;

public sealed record GetUsersQuery() : IQuery<IReadOnlyList<UserSummaryResponse>>;

public sealed class GetUsersQueryHandler : IQueryHandler<GetUsersQuery, IReadOnlyList<UserSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetUsersQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<UserSummaryResponse>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var users = await _dbContext.Users
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .OrderBy(entity => entity.DisplayName)
            .ToListAsync(cancellationToken);

        var responses = new List<UserSummaryResponse>(users.Count);
        foreach (var user in users)
        {
            var departments = await UserDepartmentAccess.GetMembershipDepartmentSummariesAsync(
                _dbContext,
                tenantId,
                user,
                cancellationToken);

            responses.Add(new UserSummaryResponse(
                user.UserId,
                user.TenantId,
                user.DepartmentId,
                user.Username,
                user.DisplayName,
                user.Email,
                user.RoleCode.ToString(),
                user.IsActive,
                user.UserSource.ToString(),
                user.Title,
                user.Phone,
                departments,
                UserRoleAccess.GetAdditionalRoleCodeStrings(user)));
        }

        return responses;
    }
}
