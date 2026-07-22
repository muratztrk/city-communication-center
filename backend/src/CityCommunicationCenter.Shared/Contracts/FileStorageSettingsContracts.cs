namespace CityCommunicationCenter.Shared.Contracts;

public sealed record FileStorageSettingsResponse(
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

public sealed record UpdateFileStorageSettingsRequest(
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

public sealed record TestFileStorageConnectivityRequest(
    string? NasHost,
    string? FtpHost,
    int FtpPort);

public sealed record TestFileStorageConnectivityResponse(
    bool Success,
    string? Message);
