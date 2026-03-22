namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantAppearanceService
{
    Task<TenantAppearanceDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task SaveSettingsAsync(Guid tenantId, TenantAppearanceUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default);
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
    string SidebarForegroundColor);