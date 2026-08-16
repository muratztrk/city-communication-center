using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using FluentValidation;
using Microsoft.Extensions.Caching.Memory;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class IzmirCbsAddressCatalog : IIzmirCbsAddressCatalog
{
    public const string HttpClientName = nameof(IzmirCbsAddressCatalog);

    private const string ControlUrl =
        "https://cbs.izmir.bel.tr/cbsuygulamalar/SehirPortaliCBSApi/BinaBilgiControl.aspx";

    private const string CbsRehberQueryUrl =
        "https://cbs.izmir.bel.tr/ArcGIS/rest/services/CbsRehber/MapServer/{0}/query";

    private const int NeighborhoodLayer = 3;
    private const int StreetCenterlineLayer = 7;
    private const int DoorLayer = 9;

    private static readonly CultureInfo Turkish = CultureInfo.GetCultureInfo("tr-TR");

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
    private readonly CityCommunicationCenterDbContext _db;
    private readonly ILogger<IzmirCbsAddressCatalog> _logger;

    public IzmirCbsAddressCatalog(
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        CityCommunicationCenterDbContext db,
        ILogger<IzmirCbsAddressCatalog> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _db = db;
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

    public async Task<IzmirCbsPointResponse?> LocateAsync(
        string districtId,
        string? neighborhood,
        string? street,
        string? streetNo,
        bool allowNeighborhoodFallback,
        CancellationToken cancellationToken)
    {
        var district = districtId.Trim();
        var neighborhoodName = neighborhood?.Trim() ?? string.Empty;
        var streetName = street?.Trim() ?? string.Empty;
        var doorName = streetNo?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(district))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(streetName)
            && !(allowNeighborhoodFallback && !string.IsNullOrWhiteSpace(neighborhoodName)))
        {
            return null;
        }

        var cacheKey =
            $"izmir-cbs:point:{district}:{CompactKey(neighborhoodName)}:{CompactStreetKey(streetName)}:{CompactKey(doorName)}:{(allowNeighborhoodFallback ? "nb" : "")}";
        if (_cache.TryGetValue(cacheKey, out PointCacheEntry? cached) && cached is not null)
        {
            return cached.Point;
        }

        var stored = await _db.IzmirCbsCatalogCaches
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.CacheKey == cacheKey, cancellationToken);
        if (stored is not null)
        {
            var storedPoint = DeserializePoint(stored.PayloadJson);
            _cache.Set(cacheKey, new PointCacheEntry(storedPoint), CacheDuration);
            return storedPoint;
        }

        IzmirCbsPointResponse? located;
        try
        {
            located = await ResolvePointAsync(
                district,
                neighborhoodName,
                streetName,
                doorName,
                allowNeighborhoodFallback,
                cancellationToken);
        }
        catch (ValidationException)
        {
            located = null;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "İzmir CBS nokta sorgusu başarısız.");
            return null;
        }

        await PersistPayloadAsync(cacheKey, JsonSerializer.Serialize(located, JsonOptions), cancellationToken);
        _cache.Set(cacheKey, new PointCacheEntry(located), CacheDuration);
        return located;
    }

    public async Task<IzmirCbsNearestAddressResponse?> FindNearestAddressAsync(
        string districtId,
        double latitude,
        double longitude,
        CancellationToken cancellationToken)
    {
        var district = districtId.Trim();
        if (string.IsNullOrWhiteSpace(district))
        {
            return null;
        }

        var cacheKey =
            $"izmir-cbs:nearest:{district}:{latitude.ToString("0.00000", CultureInfo.InvariantCulture)}:{longitude.ToString("0.00000", CultureInfo.InvariantCulture)}";
        if (_cache.TryGetValue(cacheKey, out IzmirCbsNearestAddressResponse? cached) && cached is not null)
        {
            return cached;
        }

        try
        {
            var neighborhoodName = await QueryContainingAttributeAsync(
                NeighborhoodLayer, latitude, longitude, distanceMeters: null, cancellationToken);
            if (string.IsNullOrWhiteSpace(neighborhoodName))
            {
                return null;
            }

            var neighborhoods = await GetNeighborhoodsAsync(district, cancellationToken);
            var neighborhood = FindOption(neighborhoods, neighborhoodName, CompactNeighborhoodKey);
            if (neighborhood is null)
            {
                return null;
            }

            var streetName = await QueryContainingAttributeAsync(
                StreetCenterlineLayer, latitude, longitude, distanceMeters: 80, cancellationToken);
            string streetCatalogName = string.Empty;
            if (!string.IsNullOrWhiteSpace(streetName))
            {
                var streets = await GetStreetsAsync(neighborhood.Id, cancellationToken);
                var street = FindOption(streets, streetName, CompactStreetKey);
                streetCatalogName = street?.Name ?? string.Empty;
            }

            var result = new IzmirCbsNearestAddressResponse(neighborhood.Name, streetCatalogName);
            _cache.Set(cacheKey, result, CacheDuration);
            return result;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "İzmir CBS ters adres sorgusu başarısız.");
            return null;
        }
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

        var stored = await _db.IzmirCbsCatalogCaches
            .AsNoTracking()
            .FirstOrDefaultAsync(row => row.CacheKey == cacheKey, cancellationToken);
        var storedOptions = DeserializePayload(stored?.PayloadJson);
        if (storedOptions.Count > 0)
        {
            _cache.Set(cacheKey, storedOptions, CacheDuration);
            return storedOptions;
        }

        try
        {
            var options = await FetchOptionsAsync(body, cancellationToken);
            await PersistPayloadAsync(cacheKey, JsonSerializer.Serialize(options, JsonOptions), cancellationToken);
            _cache.Set(cacheKey, options, CacheDuration);
            return options;
        }
        catch (ValidationException) when (storedOptions.Count > 0)
        {
            return storedOptions;
        }
    }

    private async Task PersistAsync(
        string cacheKey,
        IReadOnlyList<IzmirCbsOptionResponse> options,
        CancellationToken cancellationToken)
        => await PersistPayloadAsync(cacheKey, JsonSerializer.Serialize(options, JsonOptions), cancellationToken);

    private async Task PersistPayloadAsync(
        string cacheKey,
        string payload,
        CancellationToken cancellationToken)
    {
        var existing = await _db.IzmirCbsCatalogCaches.FirstOrDefaultAsync(
            row => row.CacheKey == cacheKey,
            cancellationToken);
        if (existing is null)
        {
            _db.IzmirCbsCatalogCaches.Add(new IzmirCbsCatalogCache
            {
                CacheKey = cacheKey,
                PayloadJson = payload,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            });
        }
        else
        {
            existing.PayloadJson = payload;
            existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private static IReadOnlyList<IzmirCbsOptionResponse> DeserializePayload(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<IzmirCbsOptionResponse>>(payload, JsonOptions)
                ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
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

    private async Task<IzmirCbsPointResponse?> ResolvePointAsync(
        string districtId,
        string neighborhoodName,
        string streetName,
        string doorName,
        bool allowNeighborhoodFallback,
        CancellationToken cancellationToken)
    {
        var neighborhoods = await GetNeighborhoodsAsync(districtId, cancellationToken);
        var neighborhood = FindOption(neighborhoods, neighborhoodName, CompactNeighborhoodKey);
        if (neighborhood is null)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(streetName))
        {
            var streets = await GetStreetsAsync(neighborhood.Id, cancellationToken);
            var street = FindOption(streets, streetName, CompactStreetKey);
            if (street is null)
            {
                return null;
            }

            if (!string.IsNullOrWhiteSpace(doorName))
            {
                var doors = await GetDoorNumbersAsync(street.Id, neighborhood.Id, cancellationToken);
                var door = FindOption(doors, doorName, CompactKey);
                if (door is null)
                {
                    return null;
                }

                var doorPoint = await QueryLayerPointAsync(DoorLayer, door.Id, cancellationToken);
                return doorPoint is null ? null : new IzmirCbsPointResponse(doorPoint.Value.Lat, doorPoint.Value.Lng, false);
            }

            var centerlineIds = await GetCachedAsync(
                $"izmir-cbs:centerline:{street.Id}:{neighborhood.Id}",
                $"5^{street.Id}|{neighborhood.Id}",
                cancellationToken);
            if (centerlineIds.Count == 0)
            {
                return null;
            }

            var ids = string.Join(
                ",",
                centerlineIds.Select(item => item.Id).Where(id => NumericId.IsMatch(id)));
            if (string.IsNullOrEmpty(ids))
            {
                return null;
            }

            var streetPoint = await QueryLayerPointAsync(StreetCenterlineLayer, ids, cancellationToken, inList: true);
            return streetPoint is null ? null : new IzmirCbsPointResponse(streetPoint.Value.Lat, streetPoint.Value.Lng, true);
        }

        if (!allowNeighborhoodFallback)
        {
            return null;
        }

        var neighborhoodPoint = await QueryLayerPointAsync(NeighborhoodLayer, neighborhood.Id, cancellationToken);
        return neighborhoodPoint is null
            ? null
            : new IzmirCbsPointResponse(neighborhoodPoint.Value.Lat, neighborhoodPoint.Value.Lng, true);
    }

    private async Task<(double Lat, double Lng)?> QueryLayerPointAsync(
        int layer,
        string cbsId,
        CancellationToken cancellationToken,
        bool inList = false)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        var where = inList ? $"CBSID in ({cbsId})" : $"CBSID = '{cbsId.Replace("'", "''", StringComparison.Ordinal)}'";
        var url = string.Format(CbsRehberQueryUrl, layer)
            + "?where=" + Uri.EscapeDataString(where)
            + "&returnGeometry=true&outFields=CBSID&outSR=4326&f=json";
        using var response = await client.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"İzmir CBS katman sorgusu HTTP {(int)response.StatusCode} döndü.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        if (!document.RootElement.TryGetProperty("features", out var features)
            || features.ValueKind != JsonValueKind.Array
            || features.GetArrayLength() == 0)
        {
            return null;
        }

        if (!features[0].TryGetProperty("geometry", out var geometry))
        {
            return null;
        }

        return ReadGeometry(geometry);
    }

    private async Task<string?> QueryContainingAttributeAsync(
        int layer,
        double latitude,
        double longitude,
        double? distanceMeters,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        var geometry = Uri.EscapeDataString(
            $"{longitude.ToString(CultureInfo.InvariantCulture)},{latitude.ToString(CultureInfo.InvariantCulture)}");
        var url = string.Format(CbsRehberQueryUrl, layer)
            + "?geometry=" + geometry
            + "&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects"
            + "&outFields=ADINUMARASI&returnGeometry=true&outSR=4326&f=json";
        if (distanceMeters is not null)
        {
            url += "&distance=" + distanceMeters.Value.ToString(CultureInfo.InvariantCulture)
                + "&units=esriSRUnit_Meter";
        }

        using var response = await client.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"İzmir CBS yakın adres sorgusu HTTP {(int)response.StatusCode} döndü.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        if (!document.RootElement.TryGetProperty("features", out var features)
            || features.ValueKind != JsonValueKind.Array
            || features.GetArrayLength() == 0)
        {
            return null;
        }

        string? bestName = null;
        var bestDistance = double.MaxValue;
        foreach (var feature in features.EnumerateArray())
        {
            if (!feature.TryGetProperty("attributes", out var attributes)
                || !attributes.TryGetProperty("ADINUMARASI", out var nameEl))
            {
                continue;
            }

            var name = nameEl.GetString()?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            var distance = 0d;
            if (feature.TryGetProperty("geometry", out var geometryEl))
            {
                var point = ReadGeometry(geometryEl);
                if (point is not null)
                {
                    distance = HaversineMeters(latitude, longitude, point.Value.Lat, point.Value.Lng);
                }
            }

            if (distance < bestDistance)
            {
                bestDistance = distance;
                bestName = name;
            }
        }

        return bestName;
    }

    private static double HaversineMeters(double lat1, double lng1, double lat2, double lng2)
    {
        const double earthMeters = 6_371_000;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180)
            * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * earthMeters * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static (double Lat, double Lng)? ReadGeometry(JsonElement geometry)
    {
        if (geometry.TryGetProperty("x", out var xEl) && geometry.TryGetProperty("y", out var yEl)
            && xEl.TryGetDouble(out var x) && yEl.TryGetDouble(out var y))
        {
            return (y, x);
        }

        if (geometry.TryGetProperty("paths", out var paths) && paths.ValueKind == JsonValueKind.Array && paths.GetArrayLength() > 0)
        {
            var path = paths[0];
            if (path.GetArrayLength() == 0)
            {
                return null;
            }

            var mid = path[path.GetArrayLength() / 2];
            if (mid.GetArrayLength() < 2)
            {
                return null;
            }

            return (mid[1].GetDouble(), mid[0].GetDouble());
        }

        if (geometry.TryGetProperty("rings", out var rings) && rings.ValueKind == JsonValueKind.Array && rings.GetArrayLength() > 0)
        {
            var ring = rings[0];
            var count = ring.GetArrayLength();
            if (count == 0)
            {
                return null;
            }

            double sumX = 0;
            double sumY = 0;
            var used = 0;
            var last = count > 1 ? count - 1 : count;
            for (var index = 0; index < last; index += 1)
            {
                var point = ring[index];
                if (point.GetArrayLength() < 2)
                {
                    continue;
                }

                sumX += point[0].GetDouble();
                sumY += point[1].GetDouble();
                used += 1;
            }

            if (used == 0)
            {
                return null;
            }

            return (sumY / used, sumX / used);
        }

        return null;
    }

    private static IzmirCbsOptionResponse? FindOption(
        IReadOnlyList<IzmirCbsOptionResponse> options,
        string name,
        Func<string, string> compact)
    {
        var key = compact(name);
        if (string.IsNullOrWhiteSpace(key))
        {
            return null;
        }

        return options.FirstOrDefault(item => compact(item.Name) == key);
    }

    private static string CompactKey(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var ch in value.Trim().ToLower(Turkish))
        {
            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(ch);
            }
        }

        return builder.ToString();
    }

    private static string CompactStreetKey(string value)
    {
        var key = CompactKey(value);
        foreach (var suffix in new[] { "caddesi", "cadde", "cad", "sokağı", "sokagi", "sokak", "sk", "bulvarı", "bulvari", "bulvar", "blv" })
        {
            if (key.Length > suffix.Length && key.EndsWith(suffix, StringComparison.Ordinal))
            {
                return key[..^suffix.Length];
            }
        }

        return key;
    }

    private static string CompactNeighborhoodKey(string value)
    {
        var key = CompactKey(value);
        foreach (var suffix in new[] { "mahallesi", "mahalle", "mah" })
        {
            if (key.Length > suffix.Length && key.EndsWith(suffix, StringComparison.Ordinal))
            {
                return key[..^suffix.Length];
            }
        }

        return key;
    }

    private static IzmirCbsPointResponse? DeserializePoint(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload) || payload == "null")
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<IzmirCbsPointResponse>(payload, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
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

    private sealed record PointCacheEntry(IzmirCbsPointResponse? Point);

    private sealed class CbsRow
    {
        [JsonPropertyName("Id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("Name")]
        public string Name { get; set; } = string.Empty;
    }
}
