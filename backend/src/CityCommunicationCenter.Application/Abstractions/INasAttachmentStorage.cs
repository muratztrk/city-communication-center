namespace CityCommunicationCenter.Application.Abstractions;

public sealed record NasAttachmentStorageCredentials(
    string Host,
    string ShareName,
    string Username,
    string Password);

/// <summary>
/// Talep/görev eklerini tenant NAS (SMB/CIFS) ayarlarına kopyalar.
/// Yerel <c>uploads/</c> birincil okuma kaynağı kalır; NAS kurumsal arşiv kopyasıdır.
/// </summary>
public interface INasAttachmentStorage
{
    Task<bool> IsEnabledAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task UploadAsync(
        Guid tenantId,
        string relativePath,
        string localPhysicalPath,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        Guid tenantId,
        string relativePath,
        CancellationToken cancellationToken = default);
}
