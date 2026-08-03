using System.Net.Http;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Http;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;

namespace CityCommunicationCenter.Infrastructure.Licensing;

/// <summary>
/// lumespec-license'a (bkz. ~/Works/lumespec-license) tenant+modül başına soru sorar. Her
/// (tenant, modül) çifti kendi "bundleId"si gibi modellenir — lisans servisinin şemasına
/// dokunulmaz, aynı altyapı tire-miras/bergama-belediyesi mobil uygulamalarını da lisanslıyor.
/// Yanıt Ed25519 ile imzalı bir JWT (compact serialization, alg=EdDSA); imza burada
/// doğrulanır, sunucunun verdiği "blocked" kararı olduğu gibi uygulanır.
/// </summary>
internal sealed class LicenseServiceClient : ILicenseServiceClient
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly LicensingOptions _options;
    private readonly ILogger<LicenseServiceClient> _logger;

    public LicenseServiceClient(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        IOptions<LicensingOptions> options,
        ILogger<LicenseServiceClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<LicenseModuleStatus> GetModuleStatusAsync(
        string tenantSlug,
        LicenseModule module,
        CancellationToken cancellationToken = default)
    {
        var bundleId = BuildBundleId(tenantSlug, module);
        var cacheKey = $"license:{bundleId}";

        if (_cache.TryGetValue(cacheKey, out LicenseModuleStatus? cached) && cached is not null)
        {
            return cached;
        }

        var status = await FetchAndVerifyAsync(bundleId, module, cancellationToken);
        _cache.Set(cacheKey, status, TimeSpan.FromMinutes(Math.Max(1, _options.CacheMinutes)));
        return status;
    }

    private static string BuildBundleId(string tenantSlug, LicenseModule module)
    {
        var moduleKey = module == LicenseModule.Citizen ? "citizen" : "internal";
        return $"{tenantSlug}.{moduleKey}";
    }

    private async Task<LicenseModuleStatus> FetchAndVerifyAsync(
        string bundleId,
        LicenseModule module,
        CancellationToken cancellationToken)
    {
        try
        {
            var fullBundleId = $"{_options.BundleIdPrefix}.{bundleId}";
            var client = _httpClientFactory.CreateClient(LicenseHttpClient.Name);
            var requestUri = $"{_options.BaseUrl.TrimEnd('/')}/v1/license?bundleId={Uri.EscapeDataString(fullBundleId)}&platform=web&lang=tr";

            using var response = await client.GetAsync(requestUri, cancellationToken);
            var token = (await response.Content.ReadAsStringAsync(cancellationToken)).Trim();

            if (!response.IsSuccessStatusCode || string.IsNullOrEmpty(token))
            {
                _logger.LogWarning("Lisans servisi {BundleId} için HTTP {Status} döndürdü — fail-open.", fullBundleId, (int)response.StatusCode);
                return FailOpen(module);
            }

            var payload = VerifyAndParse(token, fullBundleId);
            if (payload is null)
            {
                return FailOpen(module);
            }

            return new LicenseModuleStatus(module, !payload.Blocked, payload.Status, payload.ValidUntil, payload.Message);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or OperationCanceledException)
        {
            _logger.LogWarning(ex, "Lisans servisine {Module} modülü için ulaşılamadı — fail-open.", module);
            return FailOpen(module);
        }
    }

    private static LicenseModuleStatus FailOpen(LicenseModule module) =>
        new(module, true, "unreachable", null, null);

    /// <summary>Ed25519 imzasını doğrular ve gövdeyi ayrıştırır; imza geçersizse null döner.</summary>
    private LicenseTokenPayload? VerifyAndParse(string token, string bundleId)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            _logger.LogWarning("Lisans yanıtı geçersiz JWT biçiminde: {BundleId}.", bundleId);
            return null;
        }

        var (headerB64, payloadB64, signatureB64) = (parts[0], parts[1], parts[2]);

        LicenseTokenHeader? header;
        try
        {
            header = JsonSerializer.Deserialize<LicenseTokenHeader>(Base64UrlDecode(headerB64), JsonOptions);
        }
        catch (JsonException)
        {
            _logger.LogWarning("Lisans yanıtı header'ı ayrıştırılamadı: {BundleId}.", bundleId);
            return null;
        }

        var publicKeyHex = _options.PublicKeys.FirstOrDefault(k => k.Kid == header?.Kid)?.PublicKeyHex;
        if (string.IsNullOrEmpty(publicKeyHex))
        {
            _logger.LogWarning("Lisans yanıtının kid'i ({Kid}) yapılandırılmış anahtarlarla eşleşmiyor: {BundleId}.", header?.Kid, bundleId);
            return null;
        }

        byte[] publicKeyBytes;
        byte[] signatureBytes;
        try
        {
            publicKeyBytes = Convert.FromHexString(publicKeyHex);
            signatureBytes = Base64UrlDecode(signatureB64);
        }
        catch (FormatException)
        {
            _logger.LogWarning("Lisans public key veya imza base64 çözümlenemedi: {BundleId}.", bundleId);
            return null;
        }

        var signingInput = Encoding.UTF8.GetBytes($"{headerB64}.{payloadB64}");
        var verifier = new Ed25519Signer();
        verifier.Init(false, new Ed25519PublicKeyParameters(publicKeyBytes, 0));
        verifier.BlockUpdate(signingInput, 0, signingInput.Length);

        if (!verifier.VerifySignature(signatureBytes))
        {
            _logger.LogWarning("Lisans yanıtının imzası doğrulanamadı: {BundleId}.", bundleId);
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<LicenseTokenPayload>(Base64UrlDecode(payloadB64), JsonOptions);
        }
        catch (JsonException)
        {
            _logger.LogWarning("Lisans yanıtı gövdesi ayrıştırılamadı: {BundleId}.", bundleId);
            return null;
        }
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + ((4 - (padded.Length % 4)) % 4), '=');
        return Convert.FromBase64String(padded);
    }

    private sealed record LicenseTokenHeader([property: JsonPropertyName("kid")] string? Kid);

    private sealed record LicenseTokenPayload(
        [property: JsonPropertyName("bundleId")] string BundleId,
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("blocked")] bool Blocked,
        [property: JsonPropertyName("validUntil")] DateTimeOffset? ValidUntil,
        [property: JsonPropertyName("message")] string? Message);
}
