using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Attachments;
using CityCommunicationCenter.Domain.Entities;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

internal sealed class AttachmentContentProvider : IAttachmentContentProvider
{
    private readonly INasAttachmentStorage _nasAttachmentStorage;
    private readonly string _uploadRootPath;

    public AttachmentContentProvider(
        INasAttachmentStorage nasAttachmentStorage,
        IOptions<AttachmentStorageOptions> options)
    {
        _nasAttachmentStorage = nasAttachmentStorage;
        _uploadRootPath = options.Value.UploadRootPath;
    }

    public async Task<AttachmentContentOpenResult?> OpenReadAsync(
        Attachment attachment,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(attachment.NasRelativePath)
            && attachment.EntityType is "Job" or "Task"
            && await _nasAttachmentStorage.IsEnabledAsync(attachment.TenantId, cancellationToken))
        {
            try
            {
                var bytes = await _nasAttachmentStorage.ReadAsync(
                    attachment.TenantId,
                    attachment.NasRelativePath,
                    cancellationToken);
                var stream = new MemoryStream(bytes, writable: false);
                return new AttachmentContentOpenResult(stream, DisposeStream: true);
            }
            catch
            {
                // NAS geçici hata — yerel kopya varsa geri düş.
            }
        }

        var localPath = ResolveLocalPath(attachment);
        if (localPath is null || !File.Exists(localPath))
        {
            return null;
        }

        return new AttachmentContentOpenResult(File.OpenRead(localPath), DisposeStream: true);
    }

    internal string? ResolveLocalPath(Attachment attachment)
    {
        if (string.IsNullOrWhiteSpace(attachment.StoredFileName))
        {
            return null;
        }

        return Path.Combine(
            _uploadRootPath,
            attachment.TenantId.ToString(),
            attachment.EntityType,
            attachment.EntityId.ToString(),
            attachment.StoredFileName);
    }
}
