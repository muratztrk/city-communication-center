namespace CityCommunicationCenter.Application.Abstractions;

public sealed record GoogleMapsReverseAddress(
    string Neighborhood,
    string Street,
    string StreetNo,
    double? Latitude = null,
    double? Longitude = null);

public interface IGoogleMapsGeocodingService
{
    Task<GoogleMapsReverseAddress?> ReverseAsync(double latitude, double longitude, CancellationToken cancellationToken);

    Task<GoogleMapsReverseAddress?> GeocodeQueryAsync(string query, CancellationToken cancellationToken);
}
