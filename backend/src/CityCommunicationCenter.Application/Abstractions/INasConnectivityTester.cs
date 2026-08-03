namespace CityCommunicationCenter.Application.Abstractions;

public sealed record NasUserTestResult(bool Success, string Message);

/// <summary>
/// NAS Bağlantı Testi'ndeki Test Kullanıcı Adı/Test Şifresi ile verilen host+paylaşıma gerçekten
/// bağlanıp bir test klasörü oluşturup siler (card #2226). Yalnızca SMB/CIFS desteklenir.
/// </summary>
public interface INasConnectivityTester
{
    Task<NasUserTestResult> TestCreateFolderAsync(
        string host,
        string shareName,
        string username,
        string password,
        CancellationToken cancellationToken = default);
}
