namespace CityCommunicationCenter.Shared.FileStorage;

/// <summary>
/// NAS ayar alanlarına girilen UNC yollarını SMB TreeConnect için normalize eder (#2347).
/// </summary>
public static class NasPathNormalizer
{
    public static string? NormalizeHost(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (LooksLikeUnc(trimmed))
        {
            var segments = SplitUnc(trimmed);
            return segments.Length > 0 ? segments[0] : trimmed;
        }

        return trimmed;
    }

    public static string? NormalizeShareName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        string? shareName;
        if (LooksLikeUnc(trimmed))
        {
            var segments = SplitUnc(trimmed);
            shareName = segments.Length >= 2
                ? segments[1]
                : segments.Length == 1 ? segments[0] : trimmed;
        }
        else
        {
            shareName = trimmed;
        }

        return ToAsciiShareName(shareName);
    }

    /// <summary>
    /// SMB paylaşım adlarında Türkçe karakterler ASCII'ye katlanır (İ→I, ş→s vb.; #2347 / NAS Tire Iletisim).
    /// </summary>
    public static string? ToAsciiShareName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return new string(value.Trim().Select(MapTurkishCharacterToAscii).ToArray());
    }

    private static char MapTurkishCharacterToAscii(char character) =>
        character switch
        {
            'ç' => 'c',
            'Ç' => 'C',
            'ğ' => 'g',
            'Ğ' => 'G',
            'ı' => 'i',
            'İ' => 'I',
            'ö' => 'o',
            'Ö' => 'O',
            'ş' => 's',
            'Ş' => 'S',
            'ü' => 'u',
            'Ü' => 'U',
            _ => character,
        };

    private static bool LooksLikeUnc(string value) =>
        value.StartsWith(@"\\", StringComparison.Ordinal) ||
        value.StartsWith("//", StringComparison.Ordinal);

    private static string[] SplitUnc(string value)
    {
        var normalized = value.Replace('/', '\\');
        return normalized
            .Split('\\', StringSplitOptions.RemoveEmptyEntries)
            .Select(segment => segment.Trim())
            .Where(segment => segment.Length > 0)
            .ToArray();
    }
}
