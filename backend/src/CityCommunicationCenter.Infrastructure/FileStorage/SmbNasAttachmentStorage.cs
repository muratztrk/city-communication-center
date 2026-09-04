using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Shared.FileStorage;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

internal sealed class SmbNasAttachmentStorage : INasAttachmentStorage
{
    private readonly ITenantFileStorageSettingsService _settingsService;
    private readonly ILogger<SmbNasAttachmentStorage> _logger;

    public SmbNasAttachmentStorage(
        ITenantFileStorageSettingsService settingsService,
        ILogger<SmbNasAttachmentStorage> logger)
    {
        _settingsService = settingsService;
        _logger = logger;
    }

    public async Task<bool> IsEnabledAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var credentials = await _settingsService.GetNasAttachmentCredentialsAsync(tenantId, cancellationToken);
        return credentials is not null;
    }

    public async Task UploadAsync(
        Guid tenantId,
        string relativePath,
        string localPhysicalPath,
        CancellationToken cancellationToken = default)
    {
        var credentials = await RequireCredentialsAsync(tenantId, cancellationToken);
        var smbPath = AttachmentNasPath.ToSmbPath(relativePath);
        var content = await File.ReadAllBytesAsync(localPhysicalPath, cancellationToken);

        await Task.Run(
            () => SmbNasSessionSupport.RunWithInvariantCulture(() =>
                SmbNasSessionSupport.ExecuteWithAuthenticatedFileStore(
                    credentials.Host,
                    credentials.ShareName,
                    credentials.Username,
                    credentials.Password,
                    fileStore => SmbNasFileOperations.UploadFile(fileStore, smbPath, content))),
            cancellationToken);
    }

    public async Task<byte[]> ReadAsync(
        Guid tenantId,
        string relativePath,
        CancellationToken cancellationToken = default)
    {
        var credentials = await RequireCredentialsAsync(tenantId, cancellationToken);
        var smbPath = AttachmentNasPath.ToSmbPath(relativePath);
        byte[]? content = null;

        await Task.Run(
            () => SmbNasSessionSupport.RunWithInvariantCulture(() =>
                SmbNasSessionSupport.ExecuteWithAuthenticatedFileStore(
                    credentials.Host,
                    credentials.ShareName,
                    credentials.Username,
                    credentials.Password,
                    fileStore => content = SmbNasFileOperations.ReadFile(fileStore, smbPath))),
            cancellationToken);

        return content ?? throw new InvalidOperationException("NAS dosyası okunamadı.");
    }

    public async Task DeleteAsync(
        Guid tenantId,
        string relativePath,
        CancellationToken cancellationToken = default)
    {
        var credentials = await RequireCredentialsAsync(tenantId, cancellationToken);
        var smbPath = AttachmentNasPath.ToSmbPath(relativePath);

        await Task.Run(
            () => SmbNasSessionSupport.RunWithInvariantCulture(() =>
                SmbNasSessionSupport.ExecuteWithAuthenticatedFileStore(
                    credentials.Host,
                    credentials.ShareName,
                    credentials.Username,
                    credentials.Password,
                    fileStore => SmbNasFileOperations.DeleteFile(fileStore, smbPath))),
            cancellationToken);
    }

    private async Task<NasAttachmentStorageCredentials> RequireCredentialsAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var credentials = await _settingsService.GetNasAttachmentCredentialsAsync(tenantId, cancellationToken);
        if (credentials is null)
        {
            _logger.LogDebug("Tenant {TenantId} için NAS eklenti replikasyonu yapılandırılmamış.", tenantId);
            throw new InvalidOperationException("NAS eklenti replikasyonu yapılandırılmamış.");
        }

        return credentials;
    }
}
