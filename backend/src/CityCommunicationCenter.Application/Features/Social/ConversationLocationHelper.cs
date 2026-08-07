using System.Globalization;
using System.Text.RegularExpressions;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// WhatsApp konum mesajı koordinatlarını içerik veya SocialMessage alanından çözer (card #6a6b9fac).
/// </summary>
internal static class ConversationLocationHelper
{
    private static readonly Regex ContentCoordsRegex = new(
        @"(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static bool LooksLikeLocationContent(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return false;
        var trimmed = content.Trim();
        return trimmed.Contains("[konum mesajı]", StringComparison.OrdinalIgnoreCase)
            || trimmed.Contains("[Location message]", StringComparison.OrdinalIgnoreCase)
            || trimmed.Contains("[location]", StringComparison.OrdinalIgnoreCase)
            || trimmed.Contains("konum mesajı", StringComparison.OrdinalIgnoreCase);
    }

    public static (double? Latitude, double? Longitude) Resolve(
        string? content,
        (double? Latitude, double? Longitude) messageCoords)
    {
        var fromContent = TryParseFromContent(content);
        if (fromContent.Latitude is not null && fromContent.Longitude is not null)
        {
            return fromContent;
        }

        // Kayıtlı yer adı ("Name - Address") [konum mesajı] içermez; SocialMessage lat/lng hâlâ geçerli (#6a74de2a).
        if (messageCoords.Latitude is not null && messageCoords.Longitude is not null)
        {
            return messageCoords;
        }

        return (null, null);
    }

    private static (double? Latitude, double? Longitude) TryParseFromContent(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return (null, null);
        var match = ContentCoordsRegex.Match(content);
        if (!match.Success) return (null, null);
        if (!double.TryParse(match.Groups[1].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat))
            return (null, null);
        if (!double.TryParse(match.Groups[2].Value, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
            return (null, null);
        if (lat is < -90 or > 90 || lon is < -180 or > 180) return (null, null);
        return (lat, lon);
    }
}
