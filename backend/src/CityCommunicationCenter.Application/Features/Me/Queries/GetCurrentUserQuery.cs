namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetCurrentUserQuery() : IQuery<CurrentUserResponse>;

public sealed class GetCurrentUserQueryHandler : IQueryHandler<GetCurrentUserQuery, CurrentUserResponse>
{
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCurrentUserQueryHandler(ITenantContextAccessor tenantContextAccessor)
    {
        _tenantContextAccessor = tenantContextAccessor;
    }

    public ValueTask<CurrentUserResponse> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();

        return ValueTask.FromResult(new CurrentUserResponse(
            context.TenantId,
            context.UserId,
            context.UserDisplayName,
            context.RoleCode,
            context.IsAuthenticated,
            context.ResolutionSource));
    }
}