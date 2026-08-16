using System.Globalization;
using System.Text.Json;
using CityCommunicationCenter.Infrastructure.Options;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class GoogleMapsGeocodingService : IGoogleMapsGeocodingService
{
    public const string HttpClientName = nameof(GoogleMapsGeocodingService);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<GoogleMapsOptions> _options;
    private readonly ILogger<GoogleMapsGeocodingService> _logger;

    public GoogleMapsGeocodingService(
        IHttpClientFactory httpClientFactory,
        IOptions<GoogleMapsOptions> options,
        ILogger<GoogleMapsGeocodingService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options;
        _logger = logger;
    }

    public Task<GoogleMapsReverseAddress?> ReverseAsync(
        double latitude,
        double longitude,
        CancellationToken cancellationToken)
        => FetchAsync(
            $"latlng={latitude.ToString(CultureInfo.InvariantCulture)},{longitude.ToString(CultureInfo.InvariantCulture)}",
            cancellationToken);

    public Task<GoogleMapsReverseAddress?> GeocodeQueryAsync(string query, CancellationToken cancellationToken)
    {
        var trimmed = query.Trim();
        if (trimmed.Length == 0) return Task.FromResult<GoogleMapsReverseAddress?>(null);
        return FetchAsync($"address={Uri.EscapeDataString(trimmed)}", cancellationToken);
    }

    private async Task<GoogleMapsReverseAddress?> FetchAsync(string query, CancellationToken cancellationToken)
    {
        var apiKey = _options.Value.ApiKey?.Trim() ?? string.Empty;
        if (apiKey.Length == 0) return null;

        var url = $"https://maps.googleapis.com/maps/api/geocode/json?{query}&language=tr&key={Uri.EscapeDataString(apiKey)}";
        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            if (!document.RootElement.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            string neighborhood = "";
            string street = "";
            string streetNo = "";
            double? latitude = null;
            double? longitude = null;
            foreach (var result in results.EnumerateArray())
            {
                if (latitude is null && TryReadLocation(result, out var lat, out var lng))
                {
                    latitude = lat;
                    longitude = lng;
                }

                if (!result.TryGetProperty("address_components", out var components) || components.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var component in components.EnumerateArray())
                {
                    var longName = component.TryGetProperty("long_name", out var name) ? name.GetString()?.Trim() ?? "" : "";
                    if (longName.Length == 0) continue;
                    var types = TypesOf(component);
                    if (streetNo.Length == 0 && types.Contains("street_number")) streetNo = longName;
                    if (street.Length == 0 && types.Contains("route")) street = longName;
                    if (neighborhood.Length == 0 && (
                        types.Contains("neighborhood")
                        || types.Contains("sublocality_level_1")
                        || types.Contains("sublocality")
                        || types.Contains("administrative_area_level_4")))
                    {
                        neighborhood = longName;
                    }
                }

                if (neighborhood.Length > 0 && street.Length > 0 && streetNo.Length > 0 && latitude is not null)
                {
                    break;
                }
            }

            if (neighborhood.Length == 0 && street.Length == 0 && streetNo.Length == 0 && latitude is null)
            {
                return null;
            }

            return new GoogleMapsReverseAddress(neighborhood, street, streetNo, latitude, longitude);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "Google Maps geocode başarısız.");
            return null;
        }
    }

    private static bool TryReadLocation(JsonElement result, out double latitude, out double longitude)
    {
        latitude = 0;
        longitude = 0;
        if (!result.TryGetProperty("geometry", out var geometry)
            || !geometry.TryGetProperty("location", out var location)
            || !location.TryGetProperty("lat", out var latEl)
            || !location.TryGetProperty("lng", out var lngEl)
            || !latEl.TryGetDouble(out latitude)
            || !lngEl.TryGetDouble(out longitude))
        {
            return false;
        }

        return double.IsFinite(latitude) && double.IsFinite(longitude);
    }

    private static HashSet<string> TypesOf(JsonElement component)
    {
        var types = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!component.TryGetProperty("types", out var array) || array.ValueKind != JsonValueKind.Array)
        {
            return types;
        }

        foreach (var item in array.EnumerateArray())
        {
            var value = item.GetString();
            if (!string.IsNullOrWhiteSpace(value)) types.Add(value);
        }

        return types;
    }
}
