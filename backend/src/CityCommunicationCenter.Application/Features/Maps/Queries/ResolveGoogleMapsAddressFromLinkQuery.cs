using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Features.Maps;

public sealed record ResolveGoogleMapsAddressFromLinkQuery(string Url, string? DistrictId)
    : IQuery<GoogleMapsAddressFromLinkResponse?>;

public sealed class ResolveGoogleMapsAddressFromLinkQueryHandler
    : IQueryHandler<ResolveGoogleMapsAddressFromLinkQuery, GoogleMapsAddressFromLinkResponse?>
{
    private const string StreetNoNone = "Yok";
    private const int StreetNoMaxLength = 6;

    private readonly IGoogleMapsGeocodingService _geocoding;

    public ResolveGoogleMapsAddressFromLinkQueryHandler(IGoogleMapsGeocodingService geocoding)
    {
        _geocoding = geocoding;
    }

    public async ValueTask<GoogleMapsAddressFromLinkResponse?> Handle(
        ResolveGoogleMapsAddressFromLinkQuery request,
        CancellationToken cancellationToken)
    {
        var original = (request.Url ?? string.Empty).Trim();
        if (original.Length == 0) return null;

        var searchText = GoogleMapsCoordinateParser.TryPlaceSearchText(original) ?? original;
        var google = await _geocoding.GeocodeQueryAsync(searchText, cancellationToken);
        var fromLink = GoogleMapsCoordinateParser.TryParse(original);
        var latitude = fromLink?.Latitude ?? google?.Latitude;
        var longitude = fromLink?.Longitude ?? google?.Longitude;
        if (latitude is null || longitude is null)
        {
            return null;
        }

        var mapsStreetNo = google?.StreetNo?.Trim() ?? "";
        var streetNo = mapsStreetNo.Length is > 0 and <= StreetNoMaxLength ? mapsStreetNo : StreetNoNone;

        return new GoogleMapsAddressFromLinkResponse(
            latitude.Value,
            longitude.Value,
            google?.Neighborhood ?? "",
            google?.Street ?? "",
            streetNo);
    }
}
