namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// WhatsApp konuşma medyası için yerel disk kopyası — Graph API süresi dolunca
/// veya Pending (henüz MediaId yok) önizleme için (R421).
/// MediaId biçimi: <c>local:{tenantId}/{entryId}{ext}</c>
/// </summary>
public static class ConversationLocalMediaStore
{
    public const string MediaIdPrefix = "local:";

    public static bool TryParseLocalMediaId(string? mediaId, out string relativePath)
    {
        relativePath = string.Empty;
        if (string.IsNullOrWhiteSpace(mediaId) || !mediaId.StartsWith(MediaIdPrefix, StringComparison.Ordinal))
        {
            return false;
        }

        relativePath = mediaId[MediaIdPrefix.Length..].Replace('\\', '/').TrimStart('/');
        if (relativePath.Contains("..", StringComparison.Ordinal) || Path.IsPathRooted(relativePath))
        {
            relativePath = string.Empty;
            return false;
        }

        return relativePath.Length > 0;
    }

    public static string BuildLocalMediaId(Guid tenantId, Guid entryId, string fileName)
    {
        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(ext) || ext.Length > 12)
        {
            ext = ".bin";
        }

        return $"{MediaIdPrefix}{tenantId:D}/conversation-media/{entryId:D}{ext.ToLowerInvariant()}";
    }

    public static async Task SaveAsync(
        string uploadRootPath,
        string localMediaId,
        byte[] content,
        CancellationToken cancellationToken)
    {
        if (!TryParseLocalMediaId(localMediaId, out var relativePath))
        {
            throw new InvalidOperationException("Geçersiz yerel medya kimliği.");
        }

        var fullPath = Path.Combine(uploadRootPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        var directory = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        await File.WriteAllBytesAsync(fullPath, content, cancellationToken);
    }

    public static async Task SaveFromFileAsync(
        string uploadRootPath,
        string localMediaId,
        string sourceFullPath,
        CancellationToken cancellationToken)
    {
        var bytes = await File.ReadAllBytesAsync(sourceFullPath, cancellationToken);
        await SaveAsync(uploadRootPath, localMediaId, bytes, cancellationToken);
    }

    public static string? ResolveFullPath(string uploadRootPath, string? mediaId)
    {
        if (!TryParseLocalMediaId(mediaId, out var relativePath))
        {
            return null;
        }

        var fullPath = Path.Combine(uploadRootPath, relativePath.Replace('/', Path.DirectorySeparatorChar));
        return File.Exists(fullPath) ? fullPath : null;
    }
}
