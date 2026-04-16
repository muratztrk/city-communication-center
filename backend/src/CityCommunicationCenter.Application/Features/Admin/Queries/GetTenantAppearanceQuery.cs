namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetTenantAppearanceQuery(Guid TenantId) : IQuery<TenantAppearanceResponse?>;

public sealed class GetTenantAppearanceQueryHandler : IRequestHandler<GetTenantAppearanceQuery, TenantAppearanceResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantAppearanceService _tenantAppearanceService;

    public GetTenantAppearanceQueryHandler(IApplicationDbContext dbContext, ITenantAppearanceService tenantAppearanceService)
    {
        _dbContext = dbContext;
        _tenantAppearanceService = tenantAppearanceService;
    }

    public async Task<TenantAppearanceResponse?> Handle(GetTenantAppearanceQuery request, CancellationToken cancellationToken)
    {
        var exists = await _dbContext.Tenants.AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        if (!exists)
        {
            return null;
        }

        var settings = await _tenantAppearanceService.GetSettingsAsync(request.TenantId, cancellationToken);
        return new TenantAppearanceResponse(
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
}
