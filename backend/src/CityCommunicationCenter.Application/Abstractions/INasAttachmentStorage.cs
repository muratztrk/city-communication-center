namespace CityCommunicationCenter.Application.Abstractions;

public sealed record NasAttachmentStorageCredentials(
    string Host,
    string ShareName,
    string Username,
    string Password,
    string? RootFolder = null);

/// <summary>
/// Talep/görev eklerini tenant NAS (SMB/CIFS) ayarlarına kopyalar ve okur.
/// NAS replikasyonu başarılıysa yerel kopya silinir; okuma önce NAS'tan yapılır (#3383).
/// </summary>
public interface INasAttachmentStorage
{
    Task<bool> IsEnabledAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task UploadAsync(
        Guid tenantId,
        string relativePath,
        string localPhysicalPath,
        CancellationToken cancellationToken = default);

    Task<byte[]> ReadAsync(
        Guid tenantId,
        string relativePath,
        CancellationToken cancellationToken = default);

    Task DeleteAsync(
        Guid tenantId,
        string relativePath,
        CancellationToken cancellationToken = default);
}
