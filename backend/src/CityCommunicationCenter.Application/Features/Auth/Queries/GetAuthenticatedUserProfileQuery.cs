using System.Security.Claims;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record GetAuthenticatedUserProfileQuery(ClaimsPrincipal Principal) : IQuery<AuthenticatedUserProfileResponse>;

public sealed class GetAuthenticatedUserProfileQueryHandler : IQueryHandler<GetAuthenticatedUserProfileQuery, AuthenticatedUserProfileResponse>
{
    private readonly IApplicationDbContext _dbContext;

    public GetAuthenticatedUserProfileQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<AuthenticatedUserProfileResponse> Handle(GetAuthenticatedUserProfileQuery request, CancellationToken cancellationToken)
    {
        var principal = request.Principal;
        var tenantIdValue = principal.FindFirst("tenant_id")?.Value ?? principal.FindFirst("tenantId")?.Value;
        var rolePageAccessJson = Guid.TryParse(tenantIdValue, out var tenantId)
            ? await _dbContext.TenantSettings
                .IgnoreQueryFilters()
                .Where(entity => entity.TenantId == tenantId)
                .Select(entity => entity.RolePageAccessJson)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var departmentIdValue = principal.FindFirst("department_id")?.Value;
        string? departmentName = null;
        if (Guid.TryParse(departmentIdValue, out var departmentId) && departmentId != Guid.Empty)
        {
            departmentName = await _dbContext.Departments
                .IgnoreQueryFilters()
                .Where(entity => entity.DepartmentId == departmentId)
                .Select(entity => entity.Name)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var userIdValue = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? principal.FindFirst("sub")?.Value;
        string? userSource = null;
        if (Guid.TryParse(userIdValue, out var userId) && userId != Guid.Empty)
        {
            userSource = await _dbContext.Users
                .IgnoreQueryFilters()
                .Where(entity => entity.UserId == userId)
                .Select(entity => entity.UserSource.ToString())
                .FirstOrDefaultAsync(cancellationToken);
        }

        var roleClaims = principal.FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var primaryRole = roleClaims.FirstOrDefault()
            ?? principal.FindFirst("role")?.Value;
        var additionalRoles = roleClaims
            .Where(value => !string.Equals(value, primaryRole, StringComparison.OrdinalIgnoreCase))
            .ToArray();

        var response = new AuthenticatedUserProfileResponse(
            userIdValue,
            principal.FindFirst(ClaimTypes.Email)?.Value ?? principal.FindFirst("email")?.Value,
            principal.FindFirst(ClaimTypes.Name)?.Value ?? principal.FindFirst("name")?.Value,
            primaryRole,
            additionalRoles.Length > 0 ? additionalRoles : null,
            principal.FindFirst("tenant_id")?.Value,
            principal.FindFirst("department_id")?.Value,
            departmentName,
            rolePageAccessJson,
            userSource);

        return response;
    }
}
