namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>
/// WhatsApp gelen medyayı tenant NAS/FTP paylaşımına taşır. Webhook HTTP yolunu bekletmez (#3953).
/// NAS/FTP doluysa kalıcı kopya yalnız uzak sunucudadır; uygulama sunucusuna yazılmaz.
/// </summary>
public interface IConversationMediaRemoteArchive
{
    Task<bool> IsEnabledAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task EnqueueAsync(
        Guid tenantId,
        string channel,
        string citizenPhone,
        string localFullPath,
        string fileName,
        CancellationToken cancellationToken = default);

    Task<byte[]?> TryReadAsync(
        Guid tenantId,
        string channel,
        string citizenPhone,
        IReadOnlyList<string> fileNames,
        CancellationToken cancellationToken = default);
}
