using System.Globalization;

namespace CityCommunicationCenter.Application.Common;

/// <summary>Türkçe arama / eşleştirme yardımcıları (i/ı/İ, ş/ğ vb.).</summary>
internal static class TurkishText
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    public static bool ContainsIgnoreCase(string? haystack, string? needle)
    {
        if (string.IsNullOrWhiteSpace(needle))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(haystack))
        {
            return false;
        }

        return Tr.CompareInfo.IndexOf(haystack, needle.Trim(), CompareOptions.IgnoreCase) >= 0;
    }

    /// <summary>Türkçe diyakritikleri ASCII'ye katlayıp küçük harfe çevirir (arama eşlemesi).</summary>
    public static string Fold(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var mapped = new string(value.Select(MapTurkishCharacter).ToArray());
        return mapped.ToLowerInvariant();
    }

    public static bool ContainsFolded(string? haystack, string? needle)
    {
        if (string.IsNullOrWhiteSpace(needle))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(haystack))
        {
            return false;
        }

        return Fold(haystack).Contains(Fold(needle), StringComparison.Ordinal);
    }

    public static bool TitleImpliesManager(string? title) =>
        ContainsIgnoreCase(title, "Müdür");

    private static char MapTurkishCharacter(char character) =>
        character switch
        {
            'ç' or 'Ç' => 'c',
            'ğ' or 'Ğ' => 'g',
            'ı' or 'İ' => 'i',
            'ö' or 'Ö' => 'o',
            'ş' or 'Ş' => 's',
            'ü' or 'Ü' => 'u',
            _ => character,
        };
}
