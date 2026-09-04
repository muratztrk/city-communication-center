using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>
/// Talep/görev eklerini yerel disk veya NAS'tan okur. NAS replikasyonu sonrası yerel kopya
/// silinmiş olabilir (#3383).
/// </summary>
public interface IAttachmentContentProvider
{
    Task<AttachmentContentOpenResult?> OpenReadAsync(Attachment attachment, CancellationToken cancellationToken = default);
}

public sealed record AttachmentContentOpenResult(Stream Stream, bool DisposeStream);
