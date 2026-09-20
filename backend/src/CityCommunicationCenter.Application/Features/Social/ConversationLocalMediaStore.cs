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

    /// <summary>
    /// Gelen WA medyası için uzantı yalnız MIME beyaz listesinden gelir (#6aac5ca5). `uploads/`
    /// kimlik doğrulamasız statik servis edildiği için Meta'nın `Content-Disposition` adındaki
    /// uzantıya güvenilemez — `.html`/`.svg` aynı origin'de çalıştırılabilir dosyaya dönüşürdü.
    /// Orijinal ad zaten entry içeriğindeki `[Dosya eki: …]` işaretinde korunur.
    /// </summary>
    public static string BuildLocalMediaIdFromMimeType(Guid tenantId, Guid entryId, string? mimeType)
    {
        return BuildLocalMediaId(tenantId, entryId, $"media{ExtensionFromMimeType(mimeType)}");
    }

    public static string ExtensionFromMimeType(string? mimeType)
    {
        var normalized = (mimeType ?? string.Empty).Split(';')[0].Trim().ToLowerInvariant();
        return normalized switch
        {
            "image/jpeg" or "image/jpg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/gif" => ".gif",
            "image/heic" => ".heic",
            "video/mp4" => ".mp4",
            "video/3gpp" => ".3gp",
            "video/quicktime" => ".mov",
            "audio/ogg" => ".ogg",
            "audio/mpeg" => ".mp3",
            "audio/mp4" => ".m4a",
            "audio/amr" => ".amr",
            "application/pdf" => ".pdf",
            "application/msword" => ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => ".docx",
            "application/vnd.ms-excel" => ".xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => ".xlsx",
            "text/plain" => ".txt",
            _ => ".bin",
        };
    }

    /// <summary>
    /// Yerel kopyayı `MediaId` biçiminden bağımsız olarak entry kimliğiyle arar: webhook indirmesi
    /// Meta media ID'sini korur, dosya adı yalnız entry kimliğini taşır (#6aac5ca5).
    /// </summary>
    public static string? ResolveEntryFullPath(string uploadRootPath, Guid tenantId, Guid entryId)
    {
        var directory = Path.Combine(
            uploadRootPath,
            tenantId.ToString("D"),
            "conversation-media");

        if (!Directory.Exists(directory))
        {
            return null;
        }

        // Yarım kalan yazımın `.tmp` artığı servis edilmesin.
        return Directory.EnumerateFiles(directory, $"{entryId:D}.*")
            .FirstOrDefault(path => !path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Geçici dosya + taşıma ile yazar: yarım yazılmış bir kopya kalıcı olarak servis edilmesin
    /// (yerel kopya `GetMedia`'da Graph'tan önce gelir — #6aac5ca5). Yazılan tam yolu döner.
    /// </summary>
    public static async Task<string> SaveAsync(
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

        // Eşzamanlı iki yazıcı aynı geçici adı paylaşırsa biri diğerinin dosyasını siliyor; ad benzersiz.
        var tempPath = $"{fullPath}.{Guid.NewGuid():N}.tmp";
        try
        {
            await File.WriteAllBytesAsync(tempPath, content, cancellationToken);
            File.Move(tempPath, fullPath, overwrite: true);
            return fullPath;
        }
        catch
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }

            throw;
        }
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
