using System.Globalization;
using System.Text.RegularExpressions;

namespace CityCommunicationCenter.Application.Common;

/// <summary>
/// Google Maps paylaşım linkinden enlem/boylam (#2764/#2767).
/// </summary>
public static class GoogleMapsCoordinateParser
{
    private static readonly Regex PlainPair = new(
        @"^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$",
        RegexOptions.Compiled);

    private static readonly Regex AtPair = new(
        @"@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)",
        RegexOptions.Compiled);

    private static readonly Regex BangPair = new(
        @"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)",
        RegexOptions.Compiled);

    private static readonly Regex QueryPair = new(
        @"[?&#](?:q|query|ll|center|destination)=(-?\d+(?:\.\d+)?)(?:%2C|,|\+)(-?\d+(?:\.\d+)?)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex MapsHost = new(
        @"(?:maps\.app\.goo\.gl|goo\.gl/maps|maps\.google\.|(?:www\.)?google(?:\.[a-z]{2,3})+/maps)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex AllowedHost = new(
        @"^(?:(?:www|maps)\.)?google(?:\.[a-z]{2,3})+$|^maps\.app\.goo\.gl$|^goo\.gl$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static bool LooksLikeGoogleMapsLink(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var trimmed = value.Trim();
        return MapsHost.IsMatch(trimmed)
            || Regex.IsMatch(trimmed, @"@-?\d+(?:\.\d+)?,-?\d+")
            || Regex.IsMatch(trimmed, @"!3d-?\d+(?:\.\d+)?!4d-?\d+");
    }

    public static bool IsAllowedMapsHost(string host)
        => !string.IsNullOrWhiteSpace(host) && AllowedHost.IsMatch(host.Trim().TrimEnd('.'));

    public static (double Latitude, double Longitude)? TryParse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        if (!LooksLikeGoogleMapsLink(trimmed)) return null;
        return TryParseCoordinatePair(trimmed);
    }

    public static (double Latitude, double Longitude)? TryParseCoordinatePair(string value)
    {
        var bang = BangPair.Match(value);
        if (bang.Success) return FinitePair(bang.Groups[1].Value, bang.Groups[2].Value);

        var at = AtPair.Match(value);
        if (at.Success) return FinitePair(at.Groups[1].Value, at.Groups[2].Value);

        var query = QueryPair.Match(value);
        if (query.Success) return FinitePair(query.Groups[1].Value, query.Groups[2].Value);

        var plain = PlainPair.Match(value.Trim());
        if (plain.Success) return FinitePair(plain.Groups[1].Value, plain.Groups[2].Value);

        return null;
    }

    /// <summary>/maps/place/Adres+Metni/ içindeki yer adı — Google address araması (#2719/#2770).</summary>
    public static string? TryPlaceSearchText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var match = Regex.Match(value, @"/maps/place/([^/@?]+)", RegexOptions.IgnoreCase);
        if (!match.Success) return null;
        var decoded = Uri.UnescapeDataString(match.Groups[1].Value.Replace('+', ' ')).Trim();
        return decoded.Length == 0 ? null : decoded;
    }

    private static (double Latitude, double Longitude)? FinitePair(string rawLat, string rawLng)
    {
        if (!double.TryParse(rawLat.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude)
            || !double.TryParse(rawLng.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude))
        {
            return null;
        }

        if (!double.IsFinite(latitude) || !double.IsFinite(longitude)) return null;
        if (latitude is < -90 or > 90 || longitude is < -180 or > 180) return null;
        return (latitude, longitude);
    }
}
