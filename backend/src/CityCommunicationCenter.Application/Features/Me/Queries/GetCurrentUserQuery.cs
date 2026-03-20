namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetCurrentUserQuery() : IQuery<CurrentUserResponse>;

public sealed class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, CurrentUserResponse>
{
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCurrentUserQueryHandler(ITenantContextAccessor tenantContextAccessor)
    {
        _tenantContextAccessor = tenantContextAccessor;
    }

    public Task<CurrentUserResponse> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();

        return Task.FromResult(new CurrentUserResponse(
            context.TenantId,
            context.UserId,
            context.UserDisplayName,
            context.RoleCode,
            context.IsAuthenticated,
            context.ResolutionSource));
    }
}