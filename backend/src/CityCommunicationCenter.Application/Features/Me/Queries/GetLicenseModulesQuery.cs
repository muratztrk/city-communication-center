namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetLicenseModulesQuery() : IQuery<IReadOnlyList<LicenseModuleResponse>>;

public sealed record LicenseModuleResponse(
    string Module,
    bool Usable,
    string Status,
    DateTimeOffset? ValidUntil,
    string? Message,
    DateTimeOffset? ExpiresAt,
    string BundleId,
    bool HasStoredToken,
    string Source,
    bool TestDisabled);

public sealed class GetLicenseModulesQueryHandler : IQueryHandler<GetLicenseModulesQuery, IReadOnlyList<LicenseModuleResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILicenseModuleStatusService _licenseModuleStatusService;

    public GetLicenseModulesQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILicenseModuleStatusService licenseModuleStatusService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _licenseModuleStatusService = licenseModuleStatusService;
    }

    public async ValueTask<IReadOnlyList<LicenseModuleResponse>> Handle(GetLicenseModulesQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var municipalityName = await _dbContext.Tenants
            .Where(tenant => tenant.TenantId == tenantId)
            .Select(tenant => tenant.MunicipalityName)
            .FirstAsync(cancellationToken);
        var tenantSlug = TenantSlug.From(municipalityName);

        var citizen = await _licenseModuleStatusService.GetModuleStatusAsync(tenantId, tenantSlug, LicenseModule.Citizen, cancellationToken);
        var internalTracking = await _licenseModuleStatusService.GetModuleStatusAsync(tenantId, tenantSlug, LicenseModule.Internal, cancellationToken);

        return
        [
            ToResponse("citizen", citizen),
            ToResponse("internal", internalTracking),
        ];
    }

    internal static LicenseModuleResponse ToResponse(string moduleKey, ResolvedLicenseModuleStatus status) =>
        new(
            moduleKey,
            status.Usable,
            status.Status,
            status.ValidUntil,
            status.Message,
            status.ExpiresAt,
            status.BundleId,
            status.HasStoredToken,
            status.Source,
            status.TestDisabled);
}
