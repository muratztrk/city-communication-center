using CityCommunicationCenter.Application.Common.Tenancy;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetTenantSettingsQuery(Guid TenantId) : IQuery<TenantSettingsResponse?>;

public sealed class GetTenantSettingsQueryHandler : IQueryHandler<GetTenantSettingsQuery, TenantSettingsResponse?>
{
    private readonly IApplicationDbContext _dbContext;

    public GetTenantSettingsQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<TenantSettingsResponse?> Handle(GetTenantSettingsQuery request, CancellationToken cancellationToken)
    {
        var tenant = await _dbContext.Tenants
            .FirstOrDefaultAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        if (tenant is null)
        {
            return null;
        }

        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        return new TenantSettingsResponse(
            tenant.TenantId,
            tenant.MunicipalityName,
            settings?.DisplayName ?? tenant.DisplayName,
            tenant.DeploymentMode.ToString(),
            tenant.IsActive,
            settings?.Theme ?? tenant.Theme,
            TenantDomainNormalizer.Normalize(tenant.Domain ?? settings?.Domain),
            settings?.DefaultSlaHours ?? 48);
    }
}