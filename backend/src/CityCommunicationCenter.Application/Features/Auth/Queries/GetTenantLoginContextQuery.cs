using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common.Tenancy;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record GetTenantLoginContextQuery(string? Host, Guid? TenantId = null) : IQuery<TenantLoginContextResponse>;

public sealed class GetTenantLoginContextQueryHandler : IRequestHandler<GetTenantLoginContextQuery, TenantLoginContextResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantAppearanceService _tenantAppearanceService;

    public GetTenantLoginContextQueryHandler(IApplicationDbContext dbContext, ITenantAppearanceService tenantAppearanceService)
    {
        _dbContext = dbContext;
        _tenantAppearanceService = tenantAppearanceService;
    }

    public async Task<TenantLoginContextResponse> Handle(GetTenantLoginContextQuery request, CancellationToken cancellationToken)
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
        if (resolvedTenant is not null)
        {
            var settings = await _tenantAppearanceService.GetSettingsAsync(resolvedTenant.TenantId, cancellationToken);
            appearance = new TenantAppearanceResponse(
                settings.ThemePreset,
                settings.PrimaryColor,
                settings.SecondaryColor,
                settings.AccentColor,
                settings.NeutralColor,
                settings.SurfaceColor,
                settings.BackgroundColor,
                settings.HeaderGradientFrom,
                settings.HeaderGradientTo,
                settings.SidebarBackgroundColor,
                settings.SidebarForegroundColor,
                settings.LogoUrl,
                settings.LoginBackgroundImageUrl,
                settings.IsCustomized);
        }

        return new TenantLoginContextResponse(
            visibleTenants,
            resolvedTenant is null ? null : ToResponse(resolvedTenant),
            hideTenantSelector,
            resolvedTenant is null,
            resolutionMode,
            normalizedHost,
            appearance);
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
