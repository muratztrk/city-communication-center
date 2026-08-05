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
        null,
        null,
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
            LoginLogoUrl = Normalize(settings.LoginLogoUrl),
            PopupLogoUrl = Normalize(settings.PopupLogoUrl),
            LoginBackgroundImageUrl = Normalize(settings.LoginBackgroundImageUrl),
            PreviousLogoUrl = ResolvePreviousUrl(existingPayload?.LogoUrl, settings.LogoUrl, existingPayload?.PreviousLogoUrl),
            PreviousLoginLogoUrl = ResolvePreviousUrl(existingPayload?.LoginLogoUrl, settings.LoginLogoUrl, existingPayload?.PreviousLoginLogoUrl),
            PreviousPopupLogoUrl = ResolvePreviousUrl(existingPayload?.PopupLogoUrl, settings.PopupLogoUrl, existingPayload?.PreviousPopupLogoUrl),
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

    public async Task<TenantAppearanceDescriptor> RestorePreviousLogoAsync(
        Guid tenantId,
        TenantLogoKind kind,
        Guid? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var current = await GetSettingsAsync(tenantId, cancellationToken);
        var directory = Path.Combine(_uploadRootPath, tenantId.ToString(), "branding");
        if (!Directory.Exists(directory))
        {
            throw new ValidationException([
                new ValidationFailure(nameof(tenantId), "Önceki logo bulunamadı.")
            ]);
        }

        var (fileBaseName, previousFileBaseName) = kind.GetFileBaseNames();
        var previousFiles = Directory.EnumerateFiles(directory, $"{previousFileBaseName}.*").ToList();
        if (previousFiles.Count == 0)
        {
            throw new ValidationException([
                new ValidationFailure(nameof(tenantId), "Önceki logo bulunamadı.")
            ]);
        }

        var previousFile = previousFiles[0];
        var previousExt = Path.GetExtension(previousFile);
        var currentFiles = Directory.EnumerateFiles(directory, $"{fileBaseName}.*")
            .Where(path => !Path.GetFileName(path).StartsWith($"{previousFileBaseName}.", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var previousBytes = await File.ReadAllBytesAsync(previousFile, cancellationToken);
        byte[]? currentBytes = null;
        string? currentExt = null;
        if (currentFiles.Count > 0)
        {
            currentBytes = await File.ReadAllBytesAsync(currentFiles[0], cancellationToken);
            currentExt = Path.GetExtension(currentFiles[0]);
        }

        foreach (var stale in currentFiles)
        {
            File.Delete(stale);
        }

        foreach (var stale in Directory.EnumerateFiles(directory, $"{previousFileBaseName}.*"))
        {
            File.Delete(stale);
        }

        await File.WriteAllBytesAsync(Path.Combine(directory, $"{fileBaseName}{previousExt}"), previousBytes, cancellationToken);
        if (currentBytes is not null && !string.IsNullOrEmpty(currentExt))
        {
            await File.WriteAllBytesAsync(Path.Combine(directory, $"{previousFileBaseName}{currentExt}"), currentBytes, cancellationToken);
        }

        var restoredLogoUrl = $"/uploads/{tenantId}/branding/{fileBaseName}{previousExt}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
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
                kind == TenantLogoKind.Institution ? restoredLogoUrl : current.LogoUrl,
                kind == TenantLogoKind.Login ? restoredLogoUrl : current.LoginLogoUrl,
                kind == TenantLogoKind.Popup ? restoredLogoUrl : current.PopupLogoUrl,
                current.LoginBackgroundImageUrl),
            actorUserId,
            cancellationToken);

        return await GetSettingsAsync(tenantId, cancellationToken);
    }

    private static string? ResolvePreviousUrl(string? oldValue, string? newValue, string? existingPrevious)
    {
        var oldNormalized = StripCacheBust(Normalize(oldValue));
        var newNormalized = StripCacheBust(Normalize(newValue));
        if (!string.Equals(oldNormalized, newNormalized, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(oldNormalized))
        {
            return oldNormalized;
        }

        return Normalize(existingPrevious);
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
            Normalize(payload.LoginLogoUrl),
            Normalize(payload.PopupLogoUrl),
            Normalize(payload.LoginBackgroundImageUrl),
            Normalize(payload.PreviousLogoUrl),
            Normalize(payload.PreviousLoginLogoUrl),
            Normalize(payload.PreviousPopupLogoUrl),
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

        public string? LoginLogoUrl { get; set; }

        public string? PopupLogoUrl { get; set; }

        public string? LoginBackgroundImageUrl { get; set; }

        public string? PreviousLogoUrl { get; set; }

        public string? PreviousLoginLogoUrl { get; set; }

        public string? PreviousPopupLogoUrl { get; set; }
    }
}
