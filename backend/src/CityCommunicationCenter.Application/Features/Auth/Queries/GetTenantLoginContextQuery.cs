using CityCommunicationCenter.Application.Common.Tenancy;
using CityCommunicationCenter.Application.Features.Admin;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record GetTenantLoginContextQuery(string? Host, Guid? TenantId = null) : IQuery<TenantLoginContextResponse>;

public sealed class GetTenantLoginContextQueryHandler : IQueryHandler<GetTenantLoginContextQuery, TenantLoginContextResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantAppearanceService _tenantAppearanceService;
    private readonly ILicenseModuleStatusService _licenseModuleStatusService;

    public GetTenantLoginContextQueryHandler(
        IApplicationDbContext dbContext,
        ITenantAppearanceService tenantAppearanceService,
        ILicenseModuleStatusService licenseModuleStatusService)
    {
        _dbContext = dbContext;
        _tenantAppearanceService = tenantAppearanceService;
        _licenseModuleStatusService = licenseModuleStatusService;
    }

    public async ValueTask<TenantLoginContextResponse> Handle(GetTenantLoginContextQuery request, CancellationToken cancellationToken)
    {
        var tenants = await _dbContext.Tenants
            .Where(entity => entity.IsActive)
            .OrderBy(entity => entity.DisplayName)
            .Select(entity => new TenantCandidate(
                entity.TenantId,
                entity.MunicipalityName,
                entity.DisplayName,
                entity.DeploymentMode.ToString(),
                entity.Domain))
            .ToListAsync(cancellationToken);

        if (tenants.Count == 0)
        {
            return new TenantLoginContextResponse([], null, false, false, "Unconfigured", null, null);
        }

        var candidates = tenants
            .Select(entity => entity with
            {
                Domain = TenantDomainNormalizer.Normalize(entity.Domain),
            })
            .ToList();

        var normalizedHost = TenantDomainNormalizer.Normalize(request.Host);
        var resolutionMode = "ManualSelection";
        var hideTenantSelector = false;
        TenantCandidate? resolvedTenant = null;

        if (request.TenantId.HasValue)
        {
            var idMatch = candidates.FirstOrDefault(t => t.TenantId == request.TenantId.Value);
            if (idMatch is not null)
            {
                resolvedTenant = idMatch;
                resolutionMode = "TenantId";
                hideTenantSelector = true;
            }
        }

        if (resolvedTenant is null && !string.IsNullOrWhiteSpace(normalizedHost))
        {
            var hostMatches = candidates
                .Where(entity => string.Equals(entity.Domain, normalizedHost, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (hostMatches.Count == 1)
            {
                resolvedTenant = hostMatches[0];
                resolutionMode = "CustomDomain";
                hideTenantSelector = true;
            }
        }

        if (resolvedTenant is null && candidates.Count == 1)
        {
            resolvedTenant = candidates[0];
            resolutionMode = "SingleTenant";
            hideTenantSelector = true;
        }

        var visibleTenants = resolvedTenant is null
            ? candidates.Select(ToResponse).ToList()
            : [ToResponse(resolvedTenant)];

        TenantAppearanceResponse? appearance = null;
        TenantLoginLicenseModulesResponse? licenseModules = null;
        if (resolvedTenant is not null)
        {
            var settings = await _tenantAppearanceService.GetSettingsAsync(resolvedTenant.TenantId, cancellationToken);
            appearance = RestorePreviousTenantLogoCommandHandler.ToResponse(settings);
            var tenantSlug = TenantSlug.From(resolvedTenant.MunicipalityName);
            var citizen = await _licenseModuleStatusService.GetModuleStatusAsync(
                resolvedTenant.TenantId,
                tenantSlug,
                LicenseModule.Citizen,
                cancellationToken);
            var internalTracking = await _licenseModuleStatusService.GetModuleStatusAsync(
                resolvedTenant.TenantId,
                tenantSlug,
                LicenseModule.Internal,
                cancellationToken);
            licenseModules = new TenantLoginLicenseModulesResponse(citizen.Usable, internalTracking.Usable);
        }

        return new TenantLoginContextResponse(
            visibleTenants,
            resolvedTenant is null ? null : ToResponse(resolvedTenant),
            hideTenantSelector,
            resolvedTenant is null,
            resolutionMode,
            normalizedHost,
            appearance,
            LicenseModules: licenseModules);
    }

    private static TenantLookupResponse ToResponse(TenantCandidate tenant)
        => new(
            tenant.TenantId,
            tenant.MunicipalityName,
            tenant.DisplayName,
            tenant.DeploymentMode,
            tenant.Domain);

    private sealed record TenantCandidate(
        Guid TenantId,
        string MunicipalityName,
        string DisplayName,
        string DeploymentMode,
        string? Domain);
}
