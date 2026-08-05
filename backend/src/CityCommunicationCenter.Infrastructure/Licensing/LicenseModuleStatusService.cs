using System.Net.Http;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Infrastructure.Licensing;

internal interface IRemoteLicenseTokenClient
{
    Task<string?> FetchTokenAsync(string fullBundleId, CancellationToken cancellationToken);
}

internal sealed class RemoteLicenseTokenClient : IRemoteLicenseTokenClient
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly LicensingOptions _options;
    private readonly ILogger<RemoteLicenseTokenClient> _logger;

    public RemoteLicenseTokenClient(
        IHttpClientFactory httpClientFactory,
        IOptions<LicensingOptions> options,
        ILogger<RemoteLicenseTokenClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string?> FetchTokenAsync(string fullBundleId, CancellationToken cancellationToken)
    {
        try
        {
            var client = _httpClientFactory.CreateClient(LicenseHttpClient.Name);
            var requestUri = $"{_options.BaseUrl.TrimEnd('/')}/v1/license?bundleId={Uri.EscapeDataString(fullBundleId)}&platform=web&lang=tr";
            using var response = await client.GetAsync(requestUri, cancellationToken);
            var token = (await response.Content.ReadAsStringAsync(cancellationToken)).Trim();

            if (!response.IsSuccessStatusCode || string.IsNullOrEmpty(token))
            {
                _logger.LogWarning("Lisans servisi {BundleId} için HTTP {Status} döndürdü.", fullBundleId, (int)response.StatusCode);
                return null;
            }

            return token;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogWarning(ex, "Lisans servisine {BundleId} için ulaşılamadı.", fullBundleId);
            return null;
        }
    }
}

internal sealed class LicenseModuleStatusService : ILicenseModuleStatusService
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ILicenseTokenVerifier _tokenVerifier;
    private readonly IRemoteLicenseTokenClient _remoteLicenseTokenClient;
    private readonly IMemoryCache _cache;
    private readonly LicensingOptions _options;
    private readonly ILogger<LicenseModuleStatusService> _logger;

    public LicenseModuleStatusService(
        IApplicationDbContext dbContext,
        ILicenseTokenVerifier tokenVerifier,
        IRemoteLicenseTokenClient remoteLicenseTokenClient,
        IMemoryCache cache,
        IOptions<LicensingOptions> options,
        ILogger<LicenseModuleStatusService> logger)
    {
        _dbContext = dbContext;
        _tokenVerifier = tokenVerifier;
        _remoteLicenseTokenClient = remoteLicenseTokenClient;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<ResolvedLicenseModuleStatus> GetModuleStatusAsync(
        Guid tenantId,
        string tenantSlug,
        LicenseModule module,
        CancellationToken cancellationToken = default)
    {
        var moduleKey = ToModuleKey(module);
        var fullBundleId = BuildFullBundleId(tenantSlug, module);
        var cacheKey = $"license-status:{tenantId:N}:{moduleKey}";

        if (_cache.TryGetValue(cacheKey, out ResolvedLicenseModuleStatus? cached) && cached is not null)
        {
            return cached;
        }

        var settings = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        var storedToken = TenantLicenseModulesJson.GetToken(settings?.LicenseModulesJson, moduleKey);
        var hasStoredToken = !string.IsNullOrWhiteSpace(storedToken);
        var storedVerified = storedToken is null ? null : _tokenVerifier.Verify(storedToken, fullBundleId);
        var storedUsable = IsCurrentlyUsable(storedVerified);

        if (storedUsable && storedVerified is not null)
        {
            var storedStatus = ToResolvedStatus(module, storedVerified, fullBundleId, hasStoredToken, "stored");
            _cache.Set(cacheKey, storedStatus, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
            return storedStatus;
        }

        var remoteToken = await _remoteLicenseTokenClient.FetchTokenAsync(fullBundleId, cancellationToken);
        if (!string.IsNullOrWhiteSpace(remoteToken))
        {
            var remoteVerified = _tokenVerifier.Verify(remoteToken, fullBundleId);
            if (remoteVerified is not null)
            {
                await PersistStoredTokenAsync(tenantId, moduleKey, remoteToken, cancellationToken);
                var remoteStatus = ToResolvedStatus(module, remoteVerified, fullBundleId, true, "remote");
                _cache.Set(cacheKey, remoteStatus, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
                return remoteStatus;
            }

            _logger.LogWarning("Lisans servisi {BundleId} için geçersiz yanıt döndürdü.", fullBundleId);
        }

        if (storedVerified is not null)
        {
            var expiredStatus = ToResolvedStatus(
                module,
                storedVerified,
                fullBundleId,
                hasStoredToken,
                "stored",
                forceUnusable: true,
                fallbackMessage: "Lisans belgesinin süresi doldu. Lumespec'ten yeni lisans kodu alıp kaydedin.");
            _cache.Set(cacheKey, expiredStatus, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
            return expiredStatus;
        }

        var missingStatus = new ResolvedLicenseModuleStatus(
            module,
            Usable: false,
            Status: remoteToken is null ? "missing" : "invalid",
            ValidUntil: null,
            Message: "Modül lisansı tanımlı değil. Lumespec'ten aldığınız lisans kodunu Ayarlar > Lisans bölümüne kaydedin.",
            ExpiresAt: null,
            BundleId: fullBundleId,
            HasStoredToken: false,
            Source: "missing");

        _cache.Set(cacheKey, missingStatus, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
        return missingStatus;
    }

    public async Task SaveStoredTokenAsync(
        Guid tenantId,
        LicenseModule module,
        string tenantSlug,
        string token,
        CancellationToken cancellationToken = default)
    {
        var moduleKey = ToModuleKey(module);
        var fullBundleId = BuildFullBundleId(tenantSlug, module);
        var verified = _tokenVerifier.Verify(token, fullBundleId)
            ?? throw new InvalidOperationException("Geçersiz lisans kodu. Lumespec tarafından imzalanmış geçerli bir belge girin.");

        if (!IsCurrentlyUsable(verified))
        {
            throw new InvalidOperationException("Lisans belgesinin süresi dolmuş veya modül engellenmiş.");
        }

        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        if (settings is null)
        {
            settings = new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
            };
            _dbContext.TenantSettings.Add(settings);
        }

        settings.LicenseModulesJson = TenantLicenseModulesJson.SetToken(settings.LicenseModulesJson, moduleKey, token.Trim());
        settings.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        _cache.Remove($"license-status:{tenantId:N}:{moduleKey}");
    }

    private async Task PersistStoredTokenAsync(
        Guid tenantId,
        string moduleKey,
        string token,
        CancellationToken cancellationToken)
    {
        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        if (settings is null)
        {
            settings = new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = tenantId,
            };
            _dbContext.TenantSettings.Add(settings);
        }

        settings.LicenseModulesJson = TenantLicenseModulesJson.SetToken(settings.LicenseModulesJson, moduleKey, token);
        settings.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);
        _cache.Remove($"license-status:{tenantId:N}:{moduleKey}");
    }

    private static bool IsCurrentlyUsable(VerifiedLicenseToken? verified) =>
        verified is not null
        && !verified.Blocked
        && verified.ExpiresAt > DateTimeOffset.UtcNow;

    private static ResolvedLicenseModuleStatus ToResolvedStatus(
        LicenseModule module,
        VerifiedLicenseToken verified,
        string bundleId,
        bool hasStoredToken,
        string source,
        bool forceUnusable = false,
        string? fallbackMessage = null)
    {
        var usable = !forceUnusable && !verified.Blocked && verified.ExpiresAt > DateTimeOffset.UtcNow;
        return new ResolvedLicenseModuleStatus(
            module,
            usable,
            verified.Status,
            verified.ValidUntil,
            fallbackMessage ?? verified.Message,
            verified.ExpiresAt,
            bundleId,
            hasStoredToken,
            source);
    }

    private string BuildFullBundleId(string tenantSlug, LicenseModule module)
    {
        var moduleKey = module == LicenseModule.Citizen ? "citizen" : "internal";
        return $"{_options.BundleIdPrefix}.{tenantSlug}.{moduleKey}";
    }

    private static string ToModuleKey(LicenseModule module) =>
        module == LicenseModule.Citizen ? "citizen" : "internal";
}
