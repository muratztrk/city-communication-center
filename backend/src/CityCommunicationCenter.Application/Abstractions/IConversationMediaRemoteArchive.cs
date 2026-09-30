namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>
/// WhatsApp gelen medyayı tenant NAS/FTP paylaşımına kopyalar. Webhook HTTP yolunu bekletmez (#3953).
/// </summary>
public interface IConversationMediaRemoteArchive
{
    Task EnqueueAsync(
        Guid tenantId,
        string channel,
        string citizenPhone,
        string localFullPath,
        string fileName,
        CancellationToken cancellationToken = default);
}
