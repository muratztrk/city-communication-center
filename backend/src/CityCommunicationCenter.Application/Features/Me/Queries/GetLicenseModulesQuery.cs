namespace CityCommunicationCenter.Application.Features.Me;

public sealed record GetLicenseModulesQuery() : IQuery<IReadOnlyList<LicenseModuleResponse>>;

public sealed record LicenseModuleResponse(string Module, bool Usable, string Status, DateTimeOffset? ValidUntil, string? Message);

public sealed class GetLicenseModulesQueryHandler : IQueryHandler<GetLicenseModulesQuery, IReadOnlyList<LicenseModuleResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILicenseServiceClient _licenseServiceClient;

    public GetLicenseModulesQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILicenseServiceClient licenseServiceClient)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _licenseServiceClient = licenseServiceClient;
    }

    public async ValueTask<IReadOnlyList<LicenseModuleResponse>> Handle(GetLicenseModulesQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var municipalityName = await _dbContext.Tenants
            .Where(tenant => tenant.TenantId == tenantId)
            .Select(tenant => tenant.MunicipalityName)
            .FirstAsync(cancellationToken);
        var tenantSlug = TenantSlug.From(municipalityName);

        var citizen = await _licenseServiceClient.GetModuleStatusAsync(tenantSlug, LicenseModule.Citizen, cancellationToken);
        var internalTracking = await _licenseServiceClient.GetModuleStatusAsync(tenantSlug, LicenseModule.Internal, cancellationToken);

        return
        [
            ToResponse("citizen", citizen),
            ToResponse("internal", internalTracking),
        ];
    }

    private static LicenseModuleResponse ToResponse(string moduleKey, LicenseModuleStatus status) =>
        new(moduleKey, status.Usable, status.Status, status.ValidUntil, status.Message);
}
