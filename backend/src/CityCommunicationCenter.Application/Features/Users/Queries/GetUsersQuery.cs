
namespace CityCommunicationCenter.Application.Features.Users;

public sealed record GetUsersQuery() : IQuery<IReadOnlyList<UserSummaryResponse>>;

public sealed class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, IReadOnlyList<UserSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetUsersQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<IReadOnlyList<UserSummaryResponse>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;

        return await _dbContext.Users
            .OrderBy(entity => entity.DisplayName)
            .Select(entity => new UserSummaryResponse(
                entity.UserId,
                entity.TenantId,
                entity.DepartmentId,
                entity.Username,
                entity.DisplayName,
                entity.Email,
                entity.RoleCode.ToString(),
                entity.IsActive,
                entity.UserSource.ToString(),
                entity.Title,
                entity.Phone))
            .ToListAsync(cancellationToken);
    }
}