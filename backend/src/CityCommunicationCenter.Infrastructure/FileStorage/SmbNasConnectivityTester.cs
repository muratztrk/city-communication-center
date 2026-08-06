using System.Net;
using System.Net.Sockets;
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
        var (explicitDomain, loginUser) = ParseSmbCredentials(username);
        var domains = BuildDomainCandidates(host, explicitDomain);

        NTStatus lastLoginStatus = NTStatus.STATUS_LOGON_FAILURE;
        Exception? lastConnectError = null;
        var anyConnected = false;

        foreach (var domain in domains)
        {
            // Başarısız Login sonrası aynı client'ta Logoff/Login STATUS_USER_SESSION_DELETED üretebiliyor
            // (#2347) — her domain denemesi fresh Connect ile yapılır.
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
                    lastConnectError = ex;
                    continue;
                }

                if (!isConnected)
                {
                    continue;
                }

                anyConnected = true;

                var loginStatus = client.Login(domain, loginUser, password);
                lastLoginStatus = loginStatus;
                if (loginStatus != NTStatus.STATUS_SUCCESS)
                {
                    continue;
                }

                try
                {
                    var fileStore = client.TreeConnect(shareName, out var treeStatus);
                    if (treeStatus != NTStatus.STATUS_SUCCESS || fileStore is null)
                    {
                        return new NasUserTestResult(
                            false,
                            $"Paylaşım adına ({shareName}) bağlanılamadı ({treeStatus}) — adı kontrol edin veya kullanıcının yetkisi olmayabilir.");
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
                            return new NasUserTestResult(
                                false,
                                $"Test klasörü oluşturulamadı ({createStatus}). Kullanıcının yazma yetkisi olmayabilir.");
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
                    try
                    {
                        client.Logoff();
                    }
                    catch
                    {
                        // Login başarılıysa Logoff best-effort.
                    }
                }
            }
            finally
            {
                try
                {
                    client.Disconnect();
                }
                catch
                {
                    // ignore
                }
            }
        }

        if (!anyConnected)
        {
            if (lastConnectError is not null)
            {
                return new NasUserTestResult(false, $"NAS sunucusuna bağlanılamadı ({host}): {lastConnectError.Message}");
            }

            return new NasUserTestResult(false, $"NAS sunucusuna bağlanılamadı ({host}). Adresi ve ağ erişimini kontrol edin.");
        }

        return new NasUserTestResult(false, FormatLoginFailureMessage(lastLoginStatus));
    }

    private static string FormatLoginFailureMessage(NTStatus status)
    {
        if (status == NTStatus.STATUS_USER_SESSION_DELETED)
        {
            return "SMB oturumu açılamadı (STATUS_USER_SESSION_DELETED). Kullanıcı adı DOMAIN\\kullanıcı biçiminde deneyin veya NAS workgroup ayarını kontrol edin.";
        }

        if (status is NTStatus.STATUS_LOGON_FAILURE or NTStatus.STATUS_WRONG_PASSWORD)
        {
            return $"Kullanıcı adı veya şifre hatalı ({status}).";
        }

        return $"NAS kullanıcı girişi başarısız ({status}).";
    }

    private static IReadOnlyList<string> BuildDomainCandidates(string host, string? explicitDomain)
    {
        var candidates = new List<string>();
        void Add(string? value)
        {
            if (value is null)
            {
                return;
            }

            if (!candidates.Contains(value, StringComparer.OrdinalIgnoreCase))
            {
                candidates.Add(value);
            }
        }

        // Açık domain (DOMAIN\user / user@domain) önce.
        Add(explicitDomain);

        // Yerel / workgroup hesapları — IP host'ta FQDN short-name türetme YAPILMAZ (#2347).
        Add(".");
        Add(string.Empty);

        if (!IsIpAddressHost(host))
        {
            var hostOnly = host.Split(':', StringSplitOptions.TrimEntries)[0];
            var dotIndex = hostOnly.IndexOf('.');
            var shortHost = dotIndex > 0 ? hostOnly[..dotIndex] : hostOnly;
            Add(shortHost);
        }

        return candidates;
    }

    /// <summary>
    /// Username'den domain çıkarır. Host IP olsa bile domain host'tan türetilmez (#2347).
    /// </summary>
    private static (string? Domain, string Username) ParseSmbCredentials(string username)
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

        return (null, trimmed);
    }

    private static bool IsIpAddressHost(string host)
    {
        var hostOnly = host.Split(':', StringSplitOptions.TrimEntries)[0].Trim();
        if (IPAddress.TryParse(hostOnly, out var address))
        {
            return address.AddressFamily is AddressFamily.InterNetwork or AddressFamily.InterNetworkV6;
        }

        return false;
    }
}
