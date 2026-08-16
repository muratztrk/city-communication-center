namespace CityCommunicationCenter.Application.Abstractions;

public sealed record GoogleMapsReverseAddress(string Neighborhood, string Street, string StreetNo);

public interface IGoogleMapsGeocodingService
{
    Task<GoogleMapsReverseAddress?> ReverseAsync(double latitude, double longitude, CancellationToken cancellationToken);
}
