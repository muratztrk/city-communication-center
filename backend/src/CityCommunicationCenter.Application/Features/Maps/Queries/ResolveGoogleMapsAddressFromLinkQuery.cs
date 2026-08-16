namespace CityCommunicationCenter.Application.Features.Maps;

public sealed record ResolveGoogleMapsAddressFromLinkQuery(string Url, string? DistrictId)
    : IQuery<GoogleMapsAddressFromLinkResponse?>;

public sealed class ResolveGoogleMapsAddressFromLinkQueryHandler
    : IQueryHandler<ResolveGoogleMapsAddressFromLinkQuery, GoogleMapsAddressFromLinkResponse?>
{
    private const string StreetNoNone = "Yok";
    private const int StreetNoMaxLength = 6;

    private readonly IGoogleMapsLinkResolver _resolver;
    private readonly IGoogleMapsGeocodingService _geocoding;
    private readonly IIzmirCbsAddressCatalog _catalog;

    public ResolveGoogleMapsAddressFromLinkQueryHandler(
        IGoogleMapsLinkResolver resolver,
        IGoogleMapsGeocodingService geocoding,
        IIzmirCbsAddressCatalog catalog)
    {
        _resolver = resolver;
        _geocoding = geocoding;
        _catalog = catalog;
    }

    public async ValueTask<GoogleMapsAddressFromLinkResponse?> Handle(
        ResolveGoogleMapsAddressFromLinkQuery request,
        CancellationToken cancellationToken)
    {
        var parsed = await _resolver.ResolveAsync(request.Url ?? string.Empty, cancellationToken);
        if (parsed is null)
        {
            return null;
        }

        var google = await _geocoding.ReverseAsync(parsed.Value.Latitude, parsed.Value.Longitude, cancellationToken);
        string neighborhood = google?.Neighborhood ?? "";
        string street = google?.Street ?? "";
        var districtId = request.DistrictId?.Trim() ?? "";
        if (districtId.Length > 0)
        {
            try
            {
                var nearest = await _catalog.FindNearestAddressAsync(
                    districtId, parsed.Value.Latitude, parsed.Value.Longitude, cancellationToken);
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
            parsed.Value.Latitude,
            parsed.Value.Longitude,
            neighborhood,
            street,
            streetNo);
    }
}
