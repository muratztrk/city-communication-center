using System.Security.Claims;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record GetAuthenticatedUserProfileQuery(ClaimsPrincipal Principal) : IQuery<AuthenticatedUserProfileResponse>;

public sealed class GetAuthenticatedUserProfileQueryHandler : IRequestHandler<GetAuthenticatedUserProfileQuery, AuthenticatedUserProfileResponse>
{
    public Task<AuthenticatedUserProfileResponse> Handle(GetAuthenticatedUserProfileQuery request, CancellationToken cancellationToken)
    {
        var principal = request.Principal;
        var response = new AuthenticatedUserProfileResponse(
            principal.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? principal.FindFirst("sub")?.Value,
            principal.FindFirst(ClaimTypes.Email)?.Value ?? principal.FindFirst("email")?.Value,
            principal.FindFirst(ClaimTypes.Name)?.Value ?? principal.FindFirst("name")?.Value,
            principal.FindFirst(ClaimTypes.Role)?.Value ?? principal.FindFirst("role")?.Value,
            principal.FindFirst("tenant_id")?.Value,
            principal.FindFirst("department_id")?.Value);

        return Task.FromResult(response);
    }
}