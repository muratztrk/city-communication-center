namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record RestorePreviousTenantLogoCommand(Guid TenantId) : ICommand<TenantAppearanceResponse>;

public sealed class RestorePreviousTenantLogoCommandHandler : ICommandHandler<RestorePreviousTenantLogoCommand, TenantAppearanceResponse>
{
    private readonly ITenantAppearanceService _tenantAppearanceService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public RestorePreviousTenantLogoCommandHandler(
        ITenantAppearanceService tenantAppearanceService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _tenantAppearanceService = tenantAppearanceService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<TenantAppearanceResponse> Handle(RestorePreviousTenantLogoCommand request, CancellationToken cancellationToken)
    {
        var actorUserId = _tenantContextAccessor.GetCurrent().UserId;
        var settings = await _tenantAppearanceService.RestorePreviousLogoAsync(request.TenantId, actorUserId, cancellationToken);

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
            settings.PreviousLogoUrl,
            settings.IsCustomized);
    }
}
