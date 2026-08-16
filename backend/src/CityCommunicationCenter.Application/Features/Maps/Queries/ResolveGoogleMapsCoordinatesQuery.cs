namespace CityCommunicationCenter.Application.Features.Maps;

public sealed record ResolveGoogleMapsCoordinatesQuery(string Url) : IQuery<GoogleMapsCoordinatesResponse?>;

public sealed class ResolveGoogleMapsCoordinatesQueryHandler
    : IQueryHandler<ResolveGoogleMapsCoordinatesQuery, GoogleMapsCoordinatesResponse?>
{
    private readonly IGoogleMapsLinkResolver _resolver;

    public ResolveGoogleMapsCoordinatesQueryHandler(IGoogleMapsLinkResolver resolver)
    {
        _resolver = resolver;
    }

    public async ValueTask<GoogleMapsCoordinatesResponse?> Handle(
        ResolveGoogleMapsCoordinatesQuery request,
        CancellationToken cancellationToken)
    {
        var parsed = await _resolver.ResolveAsync(request.Url ?? string.Empty, cancellationToken);
        return parsed is null ? null : new GoogleMapsCoordinatesResponse(parsed.Value.Latitude, parsed.Value.Longitude);
    }
}
