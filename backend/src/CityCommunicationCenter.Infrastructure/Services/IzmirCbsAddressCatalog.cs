using System.Net.Http.Headers;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using CityCommunicationCenter.Shared.Contracts;
using FluentValidation;
using Microsoft.Extensions.Caching.Memory;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class IzmirCbsAddressCatalog : IIzmirCbsAddressCatalog
{
    public const string HttpClientName = nameof(IzmirCbsAddressCatalog);

    private const string ControlUrl =
        "https://cbs.izmir.bel.tr/cbsuygulamalar/SehirPortaliCBSApi/BinaBilgiControl.aspx";

    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(6);
    private static readonly Regex NumericId = new(@"^-?\d+$", RegexOptions.Compiled);
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // CBS Adres Ara cmbIlce değerleri (BinaBilgi.aspx).
    private static readonly Dictionary<string, string> DistrictCbsIds = new(StringComparer.OrdinalIgnoreCase)
    {
        ["aliaga"] = "3",
        ["balcova"] = "14",
        ["bayindir"] = "7",
        ["bayrakli"] = "11",
        ["bergama"] = "999",
        ["beydağ"] = "993",
        ["bornova"] = "2",
        ["buca"] = "8",
        ["cesme"] = "1001",
        ["cigli"] = "16",
        ["dikili"] = "995",
        ["foca"] = "4",
        ["gaziemir"] = "15",
        ["guzelbahe"] = "1",
        ["karabaglar"] = "19",
        ["karaburun"] = "1000",
        ["karsiyaka"] = "20",
        ["kemalpasa"] = "6",
        ["kinik"] = "996",
        ["kiraz"] = "994",
        ["konak"] = "21",
        ["menderes"] = "13",
        ["menemen"] = "17",
        ["narlidere"] = "5",
        ["odemis"] = "998",
        ["seferihisar"] = "12",
        ["selcuk"] = "10",
        ["tire"] = "997",
        ["torbali"] = "9",
        ["urla"] = "18",
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<IzmirCbsAddressCatalog> _logger;

    public IzmirCbsAddressCatalog(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<IzmirCbsAddressCatalog> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public Task<IReadOnlyList<IzmirCbsOptionResponse>> GetNeighborhoodsAsync(
        string districtId,
        CancellationToken cancellationToken)
    {
        var trimmed = districtId.Trim();
        if (!DistrictCbsIds.TryGetValue(trimmed, out var cbsDistrictId))
        {
            throw new ValidationException("Geçersiz ilçe değeri.");
        }

        return GetCachedAsync(
            $"izmir-cbs:neighborhoods:{cbsDistrictId}",
            $"2^{cbsDistrictId}|adres",
            cancellationToken);
    }

    public Task<IReadOnlyList<IzmirCbsOptionResponse>> GetStreetsAsync(
        string neighborhoodId,
        CancellationToken cancellationToken)
    {
        var id = RequireNumericId(neighborhoodId, "Geçersiz mahalle değeri.");
        return GetCachedAsync(
            $"izmir-cbs:streets:{id}",
            $"3^{id}",
            cancellationToken);
    }

    public Task<IReadOnlyList<IzmirCbsOptionResponse>> GetDoorNumbersAsync(
        string streetId,
        string neighborhoodId,
        CancellationToken cancellationToken)
    {
        var street = RequireNumericId(streetId, "Geçersiz cadde/sokak değeri.");
        var neighborhood = RequireNumericId(neighborhoodId, "Geçersiz mahalle değeri.");
        return GetCachedAsync(
            $"izmir-cbs:doors:{street}:{neighborhood}",
            $"4^{street}|{neighborhood}",
            cancellationToken);
    }

    private async Task<IReadOnlyList<IzmirCbsOptionResponse>> GetCachedAsync(
        string cacheKey,
        string body,
        CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<IzmirCbsOptionResponse>? cached) && cached is not null)
        {
            return cached;
        }

        var options = await FetchOptionsAsync(body, cancellationToken);
        _cache.Set(cacheKey, options, CacheDuration);
        return options;
    }

    private async Task<IReadOnlyList<IzmirCbsOptionResponse>> FetchOptionsAsync(
        string body,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        using var content = new StringContent(body, Encoding.UTF8);
        content.Headers.ContentType = new MediaTypeHeaderValue("application/x-www-form-urlencoded")
        {
            CharSet = "utf-8",
        };

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsync(ControlUrl, content, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "İzmir CBS adres kataloğuna ulaşılamadı.");
            throw new ValidationException("İzmir CBS adres kataloğuna şu an ulaşılamıyor.");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("İzmir CBS adres kataloğu HTTP {StatusCode} döndü.", (int)response.StatusCode);
                throw new ValidationException("İzmir CBS adres kataloğuna şu an ulaşılamıyor.");
            }

            var payload = await response.Content.ReadAsStringAsync(cancellationToken);
            try
            {
                var rows = JsonSerializer.Deserialize<List<CbsRow>>(payload, JsonOptions) ?? [];
                return rows
                    .Where(row => !string.IsNullOrWhiteSpace(row.Id) && !string.IsNullOrWhiteSpace(row.Name))
                    .Select(row => new IzmirCbsOptionResponse(row.Id.Trim(), row.Name.Trim()))
                    .ToArray();
            }
            catch (JsonException exception)
            {
                _logger.LogWarning(exception, "İzmir CBS adres kataloğu beklenmeyen yanıt döndü.");
                throw new ValidationException("İzmir CBS adres kataloğuna şu an ulaşılamıyor.");
            }
        }
    }

    private static string RequireNumericId(string value, string message)
    {
        var trimmed = value.Trim();
        if (!NumericId.IsMatch(trimmed))
        {
            throw new ValidationException(message);
        }

        return trimmed;
    }

    private sealed class CbsRow
    {
        [JsonPropertyName("Id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("Name")]
        public string Name { get; set; } = string.Empty;
    }
}
