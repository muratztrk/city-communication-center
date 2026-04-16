namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantAppearanceService : ITenantAppearanceService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static readonly TenantAppearanceDescriptor DefaultAppearance = new(
        "tire-municipal-green",
        "#0A8F3E",
        "#53B748",
        "#1F2328",
        "#4F5B54",
        "#FFFFFF",
        "#F3F8F4",
        "#0B6B36",
        "#1A1E1C",
        "#171A18",
        "#F4FAF5",
        null,
        null,
        false);

    private readonly IApplicationDbContext _dbContext;

    public TenantAppearanceService(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TenantAppearanceDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var payload = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.AppearanceJson)
            .SingleOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(payload))
        {
            return DefaultAppearance;
        }

        var appearancePayload = JsonSerializer.Deserialize<TenantAppearancePayload>(payload, SerializerOptions);
        if (appearancePayload is null)
        {
            return DefaultAppearance;
        }

        return ToDescriptor(appearancePayload, true);
    }

    public async Task SaveSettingsAsync(Guid tenantId, TenantAppearanceUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var tenantSetting = await _dbContext.TenantSettings
            .IgnoreQueryFilters()
            .SingleOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        var payload = new TenantAppearancePayload
        {
            ThemePreset = Normalize(settings.ThemePreset) ?? DefaultAppearance.ThemePreset,
            PrimaryColor = Normalize(settings.PrimaryColor) ?? DefaultAppearance.PrimaryColor,
            SecondaryColor = Normalize(settings.SecondaryColor) ?? DefaultAppearance.SecondaryColor,
            AccentColor = Normalize(settings.AccentColor) ?? DefaultAppearance.AccentColor,
            NeutralColor = Normalize(settings.NeutralColor) ?? DefaultAppearance.NeutralColor,
            SurfaceColor = Normalize(settings.SurfaceColor) ?? DefaultAppearance.SurfaceColor,
            BackgroundColor = Normalize(settings.BackgroundColor) ?? DefaultAppearance.BackgroundColor,
            HeaderGradientFrom = Normalize(settings.HeaderGradientFrom) ?? DefaultAppearance.HeaderGradientFrom,
            HeaderGradientTo = Normalize(settings.HeaderGradientTo) ?? DefaultAppearance.HeaderGradientTo,
            SidebarBackgroundColor = Normalize(settings.SidebarBackgroundColor) ?? DefaultAppearance.SidebarBackgroundColor,
            SidebarForegroundColor = Normalize(settings.SidebarForegroundColor) ?? DefaultAppearance.SidebarForegroundColor,
            LogoUrl = Normalize(settings.LogoUrl),
            LoginBackgroundImageUrl = Normalize(settings.LoginBackgroundImageUrl),
        };

        if (tenantSetting is null)
        {
            _dbContext.TenantSettings.Add(new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
                DisplayName = string.Empty,
                DefaultSlaHours = 48,
                AutoRoutingEnabled = false,
                AppearanceJson = JsonSerializer.Serialize(payload, SerializerOptions),
                CreatedByUserId = actorUserId,
            });
        }
        else
        {
            tenantSetting.AppearanceJson = JsonSerializer.Serialize(payload, SerializerOptions);
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            tenantSetting.UpdatedByUserId = actorUserId;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static TenantAppearanceDescriptor ToDescriptor(TenantAppearancePayload payload, bool isCustomized)
        => new(
            Normalize(payload.ThemePreset) ?? DefaultAppearance.ThemePreset,
            Normalize(payload.PrimaryColor) ?? DefaultAppearance.PrimaryColor,
            Normalize(payload.SecondaryColor) ?? DefaultAppearance.SecondaryColor,
            Normalize(payload.AccentColor) ?? DefaultAppearance.AccentColor,
            Normalize(payload.NeutralColor) ?? DefaultAppearance.NeutralColor,
            Normalize(payload.SurfaceColor) ?? DefaultAppearance.SurfaceColor,
            Normalize(payload.BackgroundColor) ?? DefaultAppearance.BackgroundColor,
            Normalize(payload.HeaderGradientFrom) ?? DefaultAppearance.HeaderGradientFrom,
            Normalize(payload.HeaderGradientTo) ?? DefaultAppearance.HeaderGradientTo,
            Normalize(payload.SidebarBackgroundColor) ?? DefaultAppearance.SidebarBackgroundColor,
            Normalize(payload.SidebarForegroundColor) ?? DefaultAppearance.SidebarForegroundColor,
            Normalize(payload.LogoUrl),
            Normalize(payload.LoginBackgroundImageUrl),
            isCustomized);

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private sealed class TenantAppearancePayload
    {
        public string? ThemePreset { get; set; }

        public string? PrimaryColor { get; set; }

        public string? SecondaryColor { get; set; }

        public string? AccentColor { get; set; }

        public string? NeutralColor { get; set; }

        public string? SurfaceColor { get; set; }

        public string? BackgroundColor { get; set; }

        public string? HeaderGradientFrom { get; set; }

        public string? HeaderGradientTo { get; set; }

        public string? SidebarBackgroundColor { get; set; }

        public string? SidebarForegroundColor { get; set; }

        public string? LogoUrl { get; set; }

        public string? LoginBackgroundImageUrl { get; set; }
    }
}
