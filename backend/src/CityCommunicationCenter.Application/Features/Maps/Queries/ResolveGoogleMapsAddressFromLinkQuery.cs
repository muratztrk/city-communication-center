namespace CityCommunicationCenter.Application.Features.Maps;

public sealed record ResolveGoogleMapsAddressFromLinkQuery(string Url, string? DistrictId)
    : IQuery<GoogleMapsAddressFromLinkResponse?>;

public sealed class ResolveGoogleMapsAddressFromLinkQueryHandler
    : IQueryHandler<ResolveGoogleMapsAddressFromLinkQuery, GoogleMapsAddressFromLinkResponse?>
{
    private const string StreetNoNone = "Yok";
    private const int StreetNoMaxLength = 6;

    private readonly IGoogleMapsGeocodingService _geocoding;
    private readonly IIzmirCbsAddressCatalog _catalog;

    public ResolveGoogleMapsAddressFromLinkQueryHandler(
        IGoogleMapsGeocodingService geocoding,
        IIzmirCbsAddressCatalog catalog)
    {
        _geocoding = geocoding;
        _catalog = catalog;
    }

    public async ValueTask<GoogleMapsAddressFromLinkResponse?> Handle(
        ResolveGoogleMapsAddressFromLinkQuery request,
        CancellationToken cancellationToken)
    {
        var google = await _geocoding.GeocodeQueryAsync(request.Url ?? string.Empty, cancellationToken);
        var latitude = google?.Latitude;
        var longitude = google?.Longitude;
        if (latitude is null || longitude is null)
        {
            return null;
        }

        string neighborhood = google?.Neighborhood ?? "";
        string street = google?.Street ?? "";
        var districtId = request.DistrictId?.Trim() ?? "";
        if (districtId.Length > 0)
        {
            try
            {
                var nearest = await _catalog.FindNearestAddressAsync(
                    districtId, latitude.Value, longitude.Value, cancellationToken);
                if (!string.IsNullOrWhiteSpace(nearest?.Neighborhood)) neighborhood = nearest.Neighborhood;
                if (!string.IsNullOrWhiteSpace(nearest?.Street)) street = nearest.Street;
            }
            catch
            {
                /* CBS yoksa Google adları kalır. */
            }
        }

        var mapsStreetNo = google?.StreetNo?.Trim() ?? "";
        var streetNo = mapsStreetNo.Length is > 0 and <= StreetNoMaxLength ? mapsStreetNo : StreetNoNone;

        return new GoogleMapsAddressFromLinkResponse(
            latitude.Value,
            longitude.Value,
            neighborhood,
            street,
            streetNo);
    }
}
