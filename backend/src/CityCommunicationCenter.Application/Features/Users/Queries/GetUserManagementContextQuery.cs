namespace CityCommunicationCenter.Application.Features.Users;

public sealed record GetUserManagementContextQuery() : IQuery<UserManagementContextResponse>;

public sealed class GetUserManagementContextQueryHandler : IRequestHandler<GetUserManagementContextQuery, UserManagementContextResponse>
{
    private readonly IUserManagementConfigurationProvider _configurationProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetUserManagementContextQueryHandler(
        IUserManagementConfigurationProvider configurationProvider,
        ITenantContextAccessor tenantContextAccessor)
    {
        _configurationProvider = configurationProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<UserManagementContextResponse> Handle(GetUserManagementContextQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var configuration = await _configurationProvider.GetConfigurationAsync(tenantId, cancellationToken);

        return new UserManagementContextResponse(
            configuration.LocalUsersEnabled,
            configuration.LdapEnabled);
    }
}