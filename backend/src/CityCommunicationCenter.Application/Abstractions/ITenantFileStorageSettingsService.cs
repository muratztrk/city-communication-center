namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantFileStorageSettingsService
{
    Task<TenantFileStorageSettingsDescriptor> GetSettingsAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default);

    Task SaveSettingsAsync(
        Guid tenantId,
        TenantFileStorageSettingsUpdate settings,
        Guid? actorUserId,
        CancellationToken cancellationToken = default);
}

public sealed record TenantFileStorageSettingsDescriptor(
    string? NasHost,
    string? NasShareName,
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
