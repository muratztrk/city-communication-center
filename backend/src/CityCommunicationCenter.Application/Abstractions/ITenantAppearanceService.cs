namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantAppearanceService
{
    Task<TenantAppearanceDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task SaveSettingsAsync(Guid tenantId, TenantAppearanceUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default);

    Task<TenantAppearanceDescriptor> RestorePreviousLogoAsync(Guid tenantId, Guid? actorUserId, CancellationToken cancellationToken = default);
}

public sealed record TenantAppearanceDescriptor(
    string ThemePreset,
    string PrimaryColor,
    string SecondaryColor,
    string AccentColor,
    string NeutralColor,
    string SurfaceColor,
    string BackgroundColor,
    string HeaderGradientFrom,
    string HeaderGradientTo,
    string SidebarBackgroundColor,
    string SidebarForegroundColor,
    string? LogoUrl,
    string? LoginBackgroundImageUrl,
    string? PreviousLogoUrl,
    bool IsCustomized);

public sealed record TenantAppearanceUpdate(
    string ThemePreset,
    string PrimaryColor,
    string SecondaryColor,
    string AccentColor,
    string NeutralColor,
    string SurfaceColor,
    string BackgroundColor,
    string HeaderGradientFrom,
    string HeaderGradientTo,
    string SidebarBackgroundColor,
    string SidebarForegroundColor,
    string? LogoUrl,
    string? LoginBackgroundImageUrl);
