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
    Task<RemoteLicenseFetchResult> FetchTokenAsync(string fullBundleId, CancellationToken cancellationToken);
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

    public async Task<RemoteLicenseFetchResult> FetchTokenAsync(string fullBundleId, CancellationToken cancellationToken)
    {
        try
        {
            var client = _httpClientFactory.CreateClient(LicenseHttpClient.Name);
            var requestUri = $"{_options.BaseUrl.TrimEnd('/')}/v1/license?bundleId={Uri.EscapeDataString(fullBundleId)}&platform=web&lang=tr";
            using var response = await client.GetAsync(requestUri, cancellationToken);
            var token = (await response.Content.ReadAsStringAsync(cancellationToken)).Trim();

            if (response.IsSuccessStatusCode && !string.IsNullOrEmpty(token))
            {
                return new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Success, token);
            }

            _logger.LogWarning(
                "Lisans servisi {BundleId} için HTTP {Status} döndürdü (askıya alınmış veya tanımsız olabilir).",
                fullBundleId,
                (int)response.StatusCode);
            return new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Denied, null);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogWarning(ex, "Lisans servisine {BundleId} için ulaşılamadı.", fullBundleId);
            return new RemoteLicenseFetchResult(RemoteLicenseFetchOutcome.Unreachable, null);
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

        if (_cache.TryGetValue(cacheKey, out ResolvedLicenseModuleStatus? cached) && cached is not null && cached.Usable)
        {
            // Yalnızca geçerli (usable) sonuç cache'lenir; askıya alma/ yeniden açma anında yansısın.
            return cached;
        }

        var settings = await _dbContext.TenantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);

        var testDisabled = TenantLicenseModulesJson.GetTestDisabled(settings?.LicenseModulesJson, moduleKey);
        if (testDisabled)
        {
            var fullBundleIdDisabled = BuildFullBundleId(tenantSlug, module);
            var disabledStatus = new ResolvedLicenseModuleStatus(
                module,
                Usable: false,
                Status: "test-disabled",
                ValidUntil: null,
                Message: "Test için geçici olarak pasife alındı.",
                ExpiresAt: null,
                BundleId: fullBundleIdDisabled,
                HasStoredToken: !string.IsNullOrWhiteSpace(TenantLicenseModulesJson.GetToken(settings?.LicenseModulesJson, moduleKey)),
                Source: "test-disabled",
                TestDisabled: true);
            _cache.Set(cacheKey, disabledStatus, TimeSpan.FromMinutes(1));
            return disabledStatus;
        }

        var storedToken = TenantLicenseModulesJson.GetToken(settings?.LicenseModulesJson, moduleKey);
        var hasStoredToken = !string.IsNullOrWhiteSpace(storedToken);
        var storedVerified = storedToken is null ? null : _tokenVerifier.Verify(storedToken, fullBundleId);
        var storedUsable = IsCurrentlyUsable(storedVerified);

        var remoteFetch = await _remoteLicenseTokenClient.FetchTokenAsync(fullBundleId, cancellationToken);

        if (remoteFetch.Outcome == RemoteLicenseFetchOutcome.Success && !string.IsNullOrWhiteSpace(remoteFetch.Token))
        {
            var remoteVerified = _tokenVerifier.Verify(remoteFetch.Token, fullBundleId);
            if (remoteVerified is not null)
            {
                await PersistStoredTokenAsync(tenantId, moduleKey, remoteFetch.Token, cancellationToken);
                var remoteStatus = ToResolvedStatus(module, remoteVerified, fullBundleId, true, "remote");
                _cache.Set(cacheKey, remoteStatus, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
                return remoteStatus;
            }

            _logger.LogWarning("Lisans servisi {BundleId} için geçersiz yanıt döndürdü.", fullBundleId);
        }

        if (remoteFetch.Outcome == RemoteLicenseFetchOutcome.Denied)
        {
            var suspendedStatus = new ResolvedLicenseModuleStatus(
                module,
                Usable: false,
                Status: storedVerified?.Blocked == true ? storedVerified.Status : "suspended",
                ValidUntil: storedVerified?.ValidUntil,
                Message: storedVerified?.Message ?? "Modül lisansı askıya alındı veya geçersiz. Lütfen Lumespec yöneticinizle iletişime geçin.",
                ExpiresAt: storedVerified?.ExpiresAt,
                BundleId: fullBundleId,
                HasStoredToken: hasStoredToken,
                Source: "remote-denied",
                TestDisabled: false);
            _cache.Set(cacheKey, suspendedStatus, TimeSpan.FromMinutes(1));
            return suspendedStatus;
        }

        if (storedUsable && storedVerified is not null)
        {
            var storedStatus = ToResolvedStatus(module, storedVerified, fullBundleId, hasStoredToken, "stored");
            _cache.Set(cacheKey, storedStatus, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
            return storedStatus;
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
            Status: "missing",
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

    public async Task SetTestDisabledAsync(
        Guid tenantId,
        LicenseModule module,
        bool disabled,
        CancellationToken cancellationToken = default)
    {
        var moduleKey = ToModuleKey(module);
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

        settings.LicenseModulesJson = TenantLicenseModulesJson.SetTestDisabled(settings.LicenseModulesJson, moduleKey, disabled);
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
