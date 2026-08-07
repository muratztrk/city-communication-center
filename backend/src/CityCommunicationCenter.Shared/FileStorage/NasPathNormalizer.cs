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
        if (LooksLikeUnc(trimmed))
        {
            var segments = SplitUnc(trimmed);
            if (segments.Length >= 2)
            {
                return segments[1];
            }

            return segments.Length == 1 ? segments[0] : trimmed;
        }

        return trimmed;
    }

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
