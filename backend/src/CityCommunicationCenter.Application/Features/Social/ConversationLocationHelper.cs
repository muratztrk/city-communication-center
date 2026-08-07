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

    // Kişi kartı / rehber paylaşımı — lat/lng sızmasın (#6a75ccfa).
    private static readonly Regex PhoneHintRegex = new(
        @"(\+?\d[\d\s\-().]{6,}\d)",
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

    public static bool LooksLikeContactContent(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return false;
        var trimmed = content.Trim();
        if (trimmed.Contains("[kişi kartı]", StringComparison.OrdinalIgnoreCase)
            || trimmed.Contains("[kisi karti]", StringComparison.OrdinalIgnoreCase)
            || trimmed.Contains("[contacts]", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // "Ad\n+90 …" / "Ad - +90 …" / "Ad · +90 …" rehber satırı (konum değil).
        if (PhoneHintRegex.IsMatch(trimmed)
            && !LooksLikeLocationContent(trimmed)
            && !ContentCoordsRegex.IsMatch(trimmed))
        {
            return true;
        }

        return false;
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

        if (messageCoords.Latitude is null || messageCoords.Longitude is null)
        {
            return (null, null);
        }

        // Kişi kartı / rehber — thread'deki konum lat/lng sızmasın (#6a75ccfa).
        if (LooksLikeContactContent(content))
        {
            return (null, null);
        }

        // SocialMessage lat/lng yalnız gerçek konum içeriğinde — [image]/medya placeholder'ına sızmasın (#6a74de2a reopen).
        if (LooksLikeLocationContent(content))
        {
            return messageCoords;
        }

        if (!string.IsNullOrWhiteSpace(content) && !IsNonLocationBracketOrAttachment(content))
        {
            // Kayıtlı yer adı ("Name - Address") — [konum mesajı] yok ama coords var.
            return messageCoords;
        }

        return (null, null);
    }

    private static bool IsNonLocationBracketOrAttachment(string content)
    {
        var trimmed = content.Trim();
        if (trimmed.StartsWith("[Dosya eki:", StringComparison.OrdinalIgnoreCase)) return true;
        if (LooksLikeContactContent(trimmed)) return true;
        if (LooksLikeLocationContent(trimmed)) return false;
        return trimmed.Length >= 3 && trimmed[0] == '[' && trimmed[^1] == ']';
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
