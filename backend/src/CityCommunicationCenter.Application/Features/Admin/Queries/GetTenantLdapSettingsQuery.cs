namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetTenantLdapSettingsQuery(Guid TenantId) : IQuery<TenantLdapSettingsResponse?>;

public sealed class GetTenantLdapSettingsQueryHandler : IRequestHandler<GetTenantLdapSettingsQuery, TenantLdapSettingsResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;

    public GetTenantLdapSettingsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantLdapSettingsService tenantLdapSettingsService)
    {
        _dbContext = dbContext;
        _tenantLdapSettingsService = tenantLdapSettingsService;
    }

    public async Task<TenantLdapSettingsResponse?> Handle(GetTenantLdapSettingsQuery request, CancellationToken cancellationToken)
    {
        var tenantExists = await _dbContext.Tenants
            .AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        if (!tenantExists)
        {
            return null;
        }

        var settings = await _tenantLdapSettingsService.GetSettingsAsync(request.TenantId, cancellationToken);

        return new TenantLdapSettingsResponse(
            settings.Enabled,
            settings.Host,
            settings.Port,
            settings.UseSsl,
            settings.IgnoreCertificateErrors,
            settings.Domain,
            settings.SearchBase,
            settings.BindDn,
            settings.HasBindPassword,
            settings.UserAttribute,
            settings.CanAuthenticate,
            settings.CanSearch);
    }
}