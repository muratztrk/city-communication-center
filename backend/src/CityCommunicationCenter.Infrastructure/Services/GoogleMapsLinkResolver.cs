using System.Net;
using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class GoogleMapsLinkResolver : IGoogleMapsLinkResolver
{
    public const string HttpClientName = nameof(GoogleMapsLinkResolver);
    private const int MaxRedirects = 8;
    private const int MaxBodyBytes = 64 * 1024;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GoogleMapsLinkResolver> _logger;

    public GoogleMapsLinkResolver(IHttpClientFactory httpClientFactory, ILogger<GoogleMapsLinkResolver> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<(double Latitude, double Longitude)?> ResolveAsync(string input, CancellationToken cancellationToken)
    {
        var direct = GoogleMapsCoordinateParser.TryParse(input);
        if (direct is not null) return direct;

        if (!Uri.TryCreate(input.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || !GoogleMapsCoordinateParser.IsAllowedMapsHost(uri.Host))
        {
            return null;
        }

        var client = _httpClientFactory.CreateClient(HttpClientName);
        for (var hop = 0; hop < MaxRedirects; hop++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            var location = response.Headers.Location;
            if (IsRedirect(response.StatusCode) && location is not null)
            {
                uri = location.IsAbsoluteUri ? location : new Uri(uri, location);
                if (!GoogleMapsCoordinateParser.IsAllowedMapsHost(uri.Host))
                {
                    _logger.LogWarning("Maps kısa link yönlendirmesi izinli olmayan hosta gitti: {Host}", uri.Host);
                    return null;
                }

                var fromRedirect = GoogleMapsCoordinateParser.TryParse(uri.ToString())
                    ?? GoogleMapsCoordinateParser.TryParseCoordinatePair(uri.ToString());
                if (fromRedirect is not null) return fromRedirect;
                continue;
            }

            var fromFinal = GoogleMapsCoordinateParser.TryParse(uri.ToString())
                ?? GoogleMapsCoordinateParser.TryParseCoordinatePair(uri.ToString());
            if (fromFinal is not null) return fromFinal;

            if (response.IsSuccessStatusCode)
            {
                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                var buffer = new byte[MaxBodyBytes];
                var read = await stream.ReadAsync(buffer.AsMemory(0, MaxBodyBytes), cancellationToken);
                var body = Encoding.UTF8.GetString(buffer.AsSpan(0, read));
                var fromBody = GoogleMapsCoordinateParser.TryParse(body)
                    ?? GoogleMapsCoordinateParser.TryParseCoordinatePair(body);
                if (fromBody is not null) return fromBody;
            }

            return null;
        }

        return GoogleMapsCoordinateParser.TryParse(uri.ToString())
            ?? GoogleMapsCoordinateParser.TryParseCoordinatePair(uri.ToString());
    }

    private static bool IsRedirect(HttpStatusCode status)
        => status is HttpStatusCode.MovedPermanently or HttpStatusCode.Found
            or HttpStatusCode.SeeOther or HttpStatusCode.TemporaryRedirect
            or HttpStatusCode.PermanentRedirect;
}
