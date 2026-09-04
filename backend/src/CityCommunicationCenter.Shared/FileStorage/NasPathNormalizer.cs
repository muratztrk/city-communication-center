using System.Text;

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
    /// Paylaşım altındaki kök klasör (ör. testtim). UNC'de üçüncü segment ve sonrası birleştirilir.
    /// </summary>
    public static string? NormalizeRootFolder(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (LooksLikeUnc(trimmed))
        {
            var segments = SplitUnc(trimmed);
            if (segments.Length <= 2)
            {
                return null;
            }

            return BuildRootFolderFromSegments(segments.AsSpan(2));
        }

        return SanitizeRootFolderSegment(trimmed);
    }

    public static bool TryParseUnc(string? value, out string? host, out string? shareName, out string? rootFolder)
    {
        host = null;
        shareName = null;
        rootFolder = null;
        if (string.IsNullOrWhiteSpace(value) || !LooksLikeUnc(value))
        {
            return false;
        }

        var segments = SplitUnc(value);
        if (segments.Length == 0)
        {
            return false;
        }

        host = NormalizeHost(value);
        shareName = NormalizeShareName(value);
        rootFolder = segments.Length > 2 ? BuildRootFolderFromSegments(segments.AsSpan(2)) : null;
        return host is not null && shareName is not null;
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

    private static string BuildRootFolderFromSegments(ReadOnlySpan<string> segments)
    {
        if (segments.Length == 0)
        {
            return string.Empty;
        }

        var parts = new string[segments.Length];
        for (var index = 0; index < segments.Length; index++)
        {
            parts[index] = SanitizeRootFolderSegment(segments[index]) ?? segments[index].Trim();
        }

        return string.Join('/', parts.Where(part => part.Length > 0));
    }

    private static string? SanitizeRootFolderSegment(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim().TrimEnd('.');
        var builder = new StringBuilder(trimmed.Length);
        foreach (var ch in trimmed)
        {
            if (ch is '\\' or '/')
            {
                continue;
            }

            builder.Append(ch);
        }

        var sanitized = builder.ToString().Trim();
        return string.IsNullOrWhiteSpace(sanitized) ? null : sanitized;
    }
}
