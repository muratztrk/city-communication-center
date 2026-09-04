namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantFileStorageSettingsService
{
    Task<TenantFileStorageSettingsDescriptor> GetSettingsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Talep/görev eki NAS replikasyonu için çözülmüş SMB kimlik bilgileri; yapılandırma eksikse null.
    /// </summary>
    Task<NasAttachmentStorageCredentials?> GetNasAttachmentCredentialsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    Task SaveSettingsAsync(
        Guid tenantId,
        TenantFileStorageSettingsUpdate settings,
        Guid? actorUserId,
        CancellationToken cancellationToken = default);

    Task<TenantDatabaseBackupSettingsDescriptor> GetDatabaseBackupSettingsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    Task SaveDatabaseBackupSettingsAsync(
        Guid tenantId,
        TenantDatabaseBackupSettingsUpdate settings,
        Guid? actorUserId,
        CancellationToken cancellationToken = default);
}

public sealed record TenantFileStorageSettingsDescriptor(
    string? NasHost,
    string? NasShareName,
    string? NasRootFolder,
    string NasProtocol,
    string? NasUsername,
    bool NasHasPassword,
    string? FtpHost,
    int FtpPort,
    string? FtpPath,
    string FtpProtocol,
    string? FtpUsername,
    bool FtpHasPassword);

public sealed record TenantFileStorageSettingsUpdate(
    string? NasHost,
    string? NasShareName,
    string? NasRootFolder,
    string NasProtocol,
    string? NasUsername,
    string? NasPassword,
    bool ClearNasPassword,
    string? FtpHost,
    int FtpPort,
    string? FtpPath,
    string FtpProtocol,
    string? FtpUsername,
    string? FtpPassword,
    bool ClearFtpPassword);

public sealed record TenantDatabaseBackupSettingsDescriptor(
    string? NasHost,
    string? NasShareName,
    string NasProtocol,
    string? NasUsername,
    bool NasHasPassword);

public sealed record TenantDatabaseBackupSettingsUpdate(
    string? NasHost,
    string? NasShareName,
    string NasProtocol,
    string? NasUsername,
    string? NasPassword,
    bool ClearNasPassword);
