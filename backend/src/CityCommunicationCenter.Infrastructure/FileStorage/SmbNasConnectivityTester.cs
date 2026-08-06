using SMBLibrary;
using SMBLibrary.Client;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

/// <summary>
/// .NET'te native bir SMB istemcisi olmadığı için SMBLibrary (saf C#) kullanılır.
/// SMBLibrary API'si senkron/bloklayan olduğu için çağrı <see cref="Task.Run(Action)"/> içinde yapılır.
/// </summary>
internal sealed class SmbNasConnectivityTester : INasConnectivityTester
{
    public Task<NasUserTestResult> TestCreateFolderAsync(
        string host,
        string shareName,
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        return Task.Run(() => TestCreateFolder(host, shareName, username, password), cancellationToken);
    }

    private static NasUserTestResult TestCreateFolder(string host, string shareName, string username, string password)
    {
        var testFolder = $"CCC-Test-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var client = new SMB2Client();
        try
        {
            bool isConnected;
            try
            {
                isConnected = client.Connect(host, SMBTransportType.DirectTCPTransport);
            }
            catch (Exception ex)
            {
                return new NasUserTestResult(false, $"NAS sunucusuna bağlanılamadı ({host}): {ex.Message}");
            }

            if (!isConnected)
            {
                return new NasUserTestResult(false, $"NAS sunucusuna bağlanılamadı ({host}). Adresi ve ağ erişimini kontrol edin.");
            }

            var (domain, loginUser) = ParseSmbCredentials(host, username);
            var loginStatus = client.Login(domain, loginUser, password);
            if (loginStatus != NTStatus.STATUS_SUCCESS && !string.Equals(domain, ".", StringComparison.Ordinal))
            {
                loginStatus = client.Login(".", loginUser, password);
            }

            if (loginStatus != NTStatus.STATUS_SUCCESS)
            {
                return new NasUserTestResult(false, $"Kullanıcı adı veya şifre hatalı ({loginStatus}).");
            }

            try
            {
                var fileStore = client.TreeConnect(shareName, out var treeStatus);
                if (treeStatus != NTStatus.STATUS_SUCCESS || fileStore is null)
                {
                    return new NasUserTestResult(false, $"Paylaşım adına ({shareName}) bağlanılamadı ({treeStatus}) — adı kontrol edin veya kullanıcının yetkisi olmayabilir.");
                }

                try
                {
                    var createStatus = fileStore.CreateFile(
                        out var directoryHandle,
                        out _,
                        testFolder,
                        AccessMask.GENERIC_WRITE | AccessMask.DELETE | AccessMask.SYNCHRONIZE,
                        SMBLibrary.FileAttributes.Directory,
                        ShareAccess.Read | ShareAccess.Write,
                        CreateDisposition.FILE_CREATE,
                        CreateOptions.FILE_DIRECTORY_FILE | CreateOptions.FILE_SYNCHRONOUS_IO_ALERT,
                        null);

                    if (createStatus != NTStatus.STATUS_SUCCESS || directoryHandle is null)
                    {
                        return new NasUserTestResult(false, $"Test klasörü oluşturulamadı ({createStatus}). Kullanıcının yazma yetkisi olmayabilir.");
                    }

                    var deleteInfo = new FileDispositionInformation { DeletePending = true };
                    fileStore.SetFileInformation(directoryHandle, deleteInfo);
                    fileStore.CloseFile(directoryHandle);

                    return new NasUserTestResult(true, "Test Başarılı — test klasörü oluşturuldu ve silindi.");
                }
                finally
                {
                    fileStore.Disconnect();
                }
            }
            finally
            {
                client.Logoff();
            }
        }
        finally
        {
            client.Disconnect();
        }
    }

    private static (string Domain, string Username) ParseSmbCredentials(string host, string username)
    {
        var trimmed = username.Trim();
        if (trimmed.Contains('\\', StringComparison.Ordinal))
        {
            var parts = trimmed.Split('\\', 2, StringSplitOptions.TrimEntries);
            return (parts[0], parts.Length > 1 ? parts[1] : trimmed);
        }

        if (trimmed.Contains('@', StringComparison.Ordinal))
        {
            var parts = trimmed.Split('@', 2, StringSplitOptions.TrimEntries);
            return (parts.Length > 1 ? parts[1] : ".", parts[0]);
        }

        var hostOnly = host.Split(':', StringSplitOptions.TrimEntries)[0];
        var dotIndex = hostOnly.IndexOf('.');
        var shortHost = dotIndex > 0 ? hostOnly[..dotIndex] : hostOnly;
        return (string.IsNullOrWhiteSpace(shortHost) ? "." : shortHost, trimmed);
    }
}
