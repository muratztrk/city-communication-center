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

        var response = new AuthenticatedUserProfileResponse(
            principal.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? principal.FindFirst("sub")?.Value,
            principal.FindFirst(ClaimTypes.Email)?.Value ?? principal.FindFirst("email")?.Value,
            principal.FindFirst(ClaimTypes.Name)?.Value ?? principal.FindFirst("name")?.Value,
            principal.FindFirst(ClaimTypes.Role)?.Value ?? principal.FindFirst("role")?.Value,
            principal.FindFirst("tenant_id")?.Value,
            principal.FindFirst("department_id")?.Value,
            departmentName,
            rolePageAccessJson);

        return response;
    }
}
