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

    public async Task<bool> IsEnabledAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var settings = scope.ServiceProvider.GetRequiredService<ITenantFileStorageSettingsService>();
        var nas = scope.ServiceProvider.GetRequiredService<INasAttachmentStorage>();
        if (await nas.IsEnabledAsync(tenantId, cancellationToken))
        {
            return true;
        }

        return await settings.GetFtpAttachmentCredentialsAsync(tenantId, cancellationToken) is not null;
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
                var nasEnabled = await nas.IsEnabledAsync(tenantId, CancellationToken.None);
                var ftp = await settings.GetFtpAttachmentCredentialsAsync(tenantId, CancellationToken.None);
                if (!nasEnabled && ftp is null)
                {
                    return;
                }

                var uploaded = false;
                if (nasEnabled)
                {
                    try
                    {
                        await nas.UploadAsync(tenantId, relativePath, localFullPath, CancellationToken.None);
                        uploaded = true;
                    }
                    catch (Exception exception)
                    {
                        _logger.LogWarning(
                            exception,
                            "WhatsApp medya NAS yüklemesi başarısız. Yol: {RelativePath}",
                            relativePath);
                    }
                }

                if (ftp is not null)
                {
                    try
                    {
                        await FtpFileOperations.UploadFileAsync(ftp, relativePath, localFullPath, CancellationToken.None);
                        uploaded = true;
                    }
                    catch (Exception exception)
                    {
                        _logger.LogWarning(
                            exception,
                            "WhatsApp medya FTP yüklemesi başarısız. Yol: {RelativePath}",
                            relativePath);
                    }
                }

                if (!uploaded)
                {
                    _logger.LogWarning(
                        "WhatsApp medya uzak arşive yazılamadı; yerel kopya duruyor. Yol: {RelativePath}",
                        relativePath);
                    return;
                }

                TryDeleteLocal(localFullPath);
            });
    }

    public async Task<byte[]?> TryReadAsync(
        Guid tenantId,
        string channel,
        string citizenPhone,
        IReadOnlyList<string> fileNames,
        CancellationToken cancellationToken = default)
    {
        if (fileNames.Count == 0 || string.IsNullOrWhiteSpace(citizenPhone))
        {
            return null;
        }

        using var scope = _scopeFactory.CreateScope();
        var settings = scope.ServiceProvider.GetRequiredService<ITenantFileStorageSettingsService>();
        var nas = scope.ServiceProvider.GetRequiredService<INasAttachmentStorage>();
        var nasEnabled = await nas.IsEnabledAsync(tenantId, cancellationToken);
        var ftp = await settings.GetFtpAttachmentCredentialsAsync(tenantId, cancellationToken);
        if (!nasEnabled && ftp is null)
        {
            return null;
        }

        foreach (var fileName in fileNames)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                continue;
            }

            var relativePath = AttachmentNasPath.BuildSocialMediaRelativePath(channel, citizenPhone, fileName);
            if (nasEnabled)
            {
                try
                {
                    return await nas.ReadAsync(tenantId, relativePath, cancellationToken);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    _logger.LogDebug(
                        exception,
                        "WhatsApp medya NAS okunamadı. Yol: {RelativePath}",
                        relativePath);
                }
            }

            if (ftp is not null)
            {
                try
                {
                    return await FtpFileOperations.DownloadFileAsync(ftp, relativePath, cancellationToken);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    _logger.LogDebug(
                        exception,
                        "WhatsApp medya FTP okunamadı. Yol: {RelativePath}",
                        relativePath);
                }
            }
        }

        return null;
    }

    private void TryDeleteLocal(string localFullPath)
    {
        if (string.IsNullOrWhiteSpace(localFullPath) || !File.Exists(localFullPath))
        {
            return;
        }

        try
        {
            File.Delete(localFullPath);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            _logger.LogWarning(
                exception,
                "WhatsApp medya yerel kopyası silinemedi. Yol: {LocalPath}",
                localFullPath);
        }
    }
}
