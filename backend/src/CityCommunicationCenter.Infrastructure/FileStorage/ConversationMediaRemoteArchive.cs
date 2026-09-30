using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Infrastructure.Services;
using CityCommunicationCenter.Shared.FileStorage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

internal sealed class ConversationMediaRemoteArchive : IConversationMediaRemoteArchive
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ConversationMediaRemoteArchive> _logger;

    public ConversationMediaRemoteArchive(
        IServiceScopeFactory scopeFactory,
        ILogger<ConversationMediaRemoteArchive> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public Task EnqueueAsync(
        Guid tenantId,
        string channel,
        string citizenPhone,
        string localFullPath,
        string fileName,
        CancellationToken cancellationToken = default)
    {
        return BackgroundNotificationWork.Enqueue(
            _logger,
            "WhatsApp medya uzak arşiv",
            async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var settings = scope.ServiceProvider.GetRequiredService<ITenantFileStorageSettingsService>();
                var nas = scope.ServiceProvider.GetRequiredService<INasAttachmentStorage>();
                var relativePath = AttachmentNasPath.BuildSocialMediaRelativePath(channel, citizenPhone, fileName);

                if (await nas.IsEnabledAsync(tenantId, CancellationToken.None))
                {
                    await nas.UploadAsync(tenantId, relativePath, localFullPath, CancellationToken.None);
                }

                var ftp = await settings.GetFtpAttachmentCredentialsAsync(tenantId, CancellationToken.None);
                if (ftp is not null)
                {
                    await FtpFileOperations.UploadFileAsync(ftp, relativePath, localFullPath, CancellationToken.None);
                }
            });
    }
}
