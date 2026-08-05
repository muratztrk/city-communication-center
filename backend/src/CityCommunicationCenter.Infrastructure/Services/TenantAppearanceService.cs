using CityCommunicationCenter.Application.Features.Attachments;
using FluentValidation;
using FluentValidation.Results;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class TenantAppearanceService : ITenantAppearanceService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static readonly TenantAppearanceDescriptor DefaultAppearance = new(
        "varsayılan-tema",
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
        "/default-institution-logo.png",
        null,
        null,
        false);

    private readonly IApplicationDbContext _dbContext;
    private readonly string _uploadRootPath;

    public TenantAppearanceService(IApplicationDbContext dbContext, IOptions<AttachmentStorageOptions> options)
    {
        _dbContext = dbContext;
        _uploadRootPath = options.Value.UploadRootPath;
    }

    public async Task<TenantAppearanceDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var payload = await _dbContext.TenantSettings
            .AsNoTracking()
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

        TenantAppearancePayload? existingPayload = null;
        if (!string.IsNullOrWhiteSpace(tenantSetting?.AppearanceJson))
        {
            existingPayload = JsonSerializer.Deserialize<TenantAppearancePayload>(tenantSetting.AppearanceJson, SerializerOptions);
        }

        var oldLogo = StripCacheBust(Normalize(existingPayload?.LogoUrl));
        var newLogo = StripCacheBust(Normalize(settings.LogoUrl));
        string? previousLogoUrl = Normalize(existingPayload?.PreviousLogoUrl);
        if (!string.Equals(oldLogo, newLogo, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(oldLogo))
        {
            previousLogoUrl = oldLogo;
        }

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
            PreviousLogoUrl = previousLogoUrl,
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

    public async Task<TenantAppearanceDescriptor> RestorePreviousLogoAsync(Guid tenantId, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var current = await GetSettingsAsync(tenantId, cancellationToken);
        var directory = Path.Combine(_uploadRootPath, tenantId.ToString(), "branding");
        if (!Directory.Exists(directory))
        {
            throw new ValidationException([
                new ValidationFailure(nameof(tenantId), "Önceki logo bulunamadı.")
            ]);
        }

        var previousFiles = Directory.EnumerateFiles(directory, "logo-previous.*").ToList();
        if (previousFiles.Count == 0)
        {
            throw new ValidationException([
                new ValidationFailure(nameof(tenantId), "Önceki logo bulunamadı.")
            ]);
        }

        var previousFile = previousFiles[0];
        var previousExt = Path.GetExtension(previousFile);
        var currentLogos = Directory.EnumerateFiles(directory, "logo.*")
            .Where(path => !Path.GetFileName(path).StartsWith("logo-previous.", StringComparison.OrdinalIgnoreCase))
            .ToList();

        byte[] previousBytes = await File.ReadAllBytesAsync(previousFile, cancellationToken);
        byte[]? currentBytes = null;
        string? currentExt = null;
        if (currentLogos.Count > 0)
        {
            currentBytes = await File.ReadAllBytesAsync(currentLogos[0], cancellationToken);
            currentExt = Path.GetExtension(currentLogos[0]);
        }

        foreach (var stale in Directory.EnumerateFiles(directory, "logo.*")
                     .Where(path => !Path.GetFileName(path).StartsWith("logo-previous.", StringComparison.OrdinalIgnoreCase)))
        {
            File.Delete(stale);
        }

        foreach (var stale in Directory.EnumerateFiles(directory, "logo-previous.*"))
        {
            File.Delete(stale);
        }

        await File.WriteAllBytesAsync(Path.Combine(directory, $"logo{previousExt}"), previousBytes, cancellationToken);
        if (currentBytes is not null && !string.IsNullOrEmpty(currentExt))
        {
            await File.WriteAllBytesAsync(Path.Combine(directory, $"logo-previous{currentExt}"), currentBytes, cancellationToken);
        }

        var restoredLogoUrl = $"/uploads/{tenantId}/branding/logo{previousExt}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        await SaveSettingsAsync(
            tenantId,
            new TenantAppearanceUpdate(
                current.ThemePreset,
                current.PrimaryColor,
                current.SecondaryColor,
                current.AccentColor,
                current.NeutralColor,
                current.SurfaceColor,
                current.BackgroundColor,
                current.HeaderGradientFrom,
                current.HeaderGradientTo,
                current.SidebarBackgroundColor,
                current.SidebarForegroundColor,
                restoredLogoUrl,
                current.LoginBackgroundImageUrl),
            actorUserId,
            cancellationToken);

        return await GetSettingsAsync(tenantId, cancellationToken);
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
            Normalize(payload.PreviousLogoUrl),
            isCustomized);

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? StripCacheBust(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        var queryIndex = trimmed.IndexOf('?', StringComparison.Ordinal);
        return queryIndex >= 0 ? trimmed[..queryIndex] : trimmed;
    }

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

        public string? PreviousLogoUrl { get; set; }
    }
}
