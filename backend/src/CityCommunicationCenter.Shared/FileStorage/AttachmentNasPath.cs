using System.Text;

namespace CityCommunicationCenter.Shared.FileStorage;

public static class AttachmentNasPath
{
    private static readonly HashSet<char> InvalidFileNameChars = new(Path.GetInvalidFileNameChars())
    {
        '\\',
        '/',
        ':',
        '*',
        '?',
        '"',
        '<',
        '>',
        '|',
    };

    public static string BuildRelativePath(string requestFolder, string originalFileName)
    {
        var folder = SanitizeSegment(requestFolder);
        var fileName = SanitizeFileName(originalFileName);
        return $"{folder}/{fileName}";
    }

    public static string BuildLegacyRelativePath(
        Guid tenantId,
        string entityType,
        Guid entityId,
        string storedFileName) =>
        $"{tenantId}/{entityType}/{entityId}/{storedFileName}";

    public static string ToSmbPath(string relativePath) =>
        relativePath.Replace('/', '\\');

    public static string SanitizeSegment(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "Talep";
        }

        var trimmed = value.Trim().TrimEnd('.');
        var builder = new StringBuilder(trimmed.Length);
        foreach (var ch in trimmed)
        {
            builder.Append(InvalidFileNameChars.Contains(ch) ? '_' : ch);
        }

        var sanitized = builder.ToString().Trim();
        return string.IsNullOrWhiteSpace(sanitized) ? "Talep" : sanitized;
    }

    public static string SanitizeFileName(string value)
    {
        var fileName = Path.GetFileName(value);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return "dosya";
        }

        var builder = new StringBuilder(fileName.Length);
        foreach (var ch in fileName)
        {
            builder.Append(InvalidFileNameChars.Contains(ch) ? '_' : ch);
        }

        var sanitized = builder.ToString().Trim();
        return string.IsNullOrWhiteSpace(sanitized) ? "dosya" : sanitized;
    }

    public static string AllocateUniqueFileName(string originalFileName, IReadOnlyCollection<string> existingFileNames)
    {
        var candidate = SanitizeFileName(originalFileName);
        if (!existingFileNames.Contains(candidate, StringComparer.OrdinalIgnoreCase))
        {
            return candidate;
        }

        var extension = Path.GetExtension(candidate);
        var baseName = Path.GetFileNameWithoutExtension(candidate);
        if (string.IsNullOrWhiteSpace(baseName))
        {
            baseName = "dosya";
        }

        for (var index = 2; index < 10_000; index++)
        {
            var next = $"{baseName} ({index}){extension}";
            if (!existingFileNames.Contains(next, StringComparer.OrdinalIgnoreCase))
            {
                return next;
            }
        }

        return $"{baseName}-{Guid.NewGuid():N}{extension}";
    }
}
