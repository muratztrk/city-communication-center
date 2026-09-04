using System.Globalization;
using System.Net;
using System.Net.Sockets;
using CityCommunicationCenter.Shared.FileStorage;
using SMBLibrary;
using SMBLibrary.Client;
using SMBLibrary.NetBios;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

/// <summary>
/// SMBLibrary ile NAS oturumu açma ve kimlik doğrulama — bağlantı testi ve ek replikasyonu ortak kullanır.
/// </summary>
internal static class SmbNasSessionSupport
{
    private static readonly TimeSpan NetBiosLookupTimeout = TimeSpan.FromSeconds(2);

    public static T RunWithInvariantCulture<T>(Func<T> func)
    {
        var previousCulture = CultureInfo.CurrentCulture;
        var previousUiCulture = CultureInfo.CurrentUICulture;
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;
        try
        {
            return func();
        }
        finally
        {
            CultureInfo.CurrentCulture = previousCulture;
            CultureInfo.CurrentUICulture = previousUiCulture;
        }
    }

    public static void RunWithInvariantCulture(Action action)
    {
        var previousCulture = CultureInfo.CurrentCulture;
        var previousUiCulture = CultureInfo.CurrentUICulture;
        CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;
        try
        {
            action();
        }
        finally
        {
            CultureInfo.CurrentCulture = previousCulture;
            CultureInfo.CurrentUICulture = previousUiCulture;
        }
    }

    public static NasUserTestResult TestCreateFolder(
        string host,
        string shareName,
        string username,
        string password,
        string? rootFolder = null)
    {
        var testFolderName = $"CCC-Test-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var testFolder = string.IsNullOrWhiteSpace(rootFolder)
            ? testFolderName
            : AttachmentNasPath.ToSmbPath(AttachmentNasPath.ApplyRootFolder(testFolderName, rootFolder));
        NasUserTestResult? failure = null;

        try
        {
            ExecuteWithAuthenticatedFileStore(
                host,
                shareName,
                username,
                password,
                fileStore =>
                {
                    SmbNasFileOperations.EnsureParentDirectoriesForPath(fileStore, testFolder);
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
                        failure = new NasUserTestResult(
                            false,
                            $"Test klasörü oluşturulamadı ({createStatus}). Kullanıcının yazma yetkisi olmayabilir.");
                        return;
                    }

                    var deleteInfo = new FileDispositionInformation { DeletePending = true };
                    fileStore.SetFileInformation(directoryHandle, deleteInfo);
                    fileStore.CloseFile(directoryHandle);
                    failure = new NasUserTestResult(true, "Test Başarılı — test klasörü oluşturuldu ve silindi.");
                });
        }
        catch (SmbNasSessionException ex)
        {
            return new NasUserTestResult(false, ex.Message);
        }

        return failure ?? new NasUserTestResult(false, "NAS testi tamamlanamadı.");
    }

    public static void ExecuteWithAuthenticatedFileStore(
        string host,
        string shareName,
        string username,
        string password,
        Action<ISMBFileStore> action)
    {
        var normalizedHost = NasPathNormalizer.NormalizeHost(host) ?? host.Trim();
        var normalizedShare = NasPathNormalizer.NormalizeShareName(shareName) ?? shareName.Trim();
        var (explicitDomain, loginUser) = ParseSmbCredentials(username);
        var serverAddress = ResolveServerAddress(normalizedHost);
        var netBiosName = serverAddress is null ? null : TryGetNetBiosServerName(serverAddress);
        var connectServerNames = BuildConnectServerNames(normalizedHost, serverAddress, netBiosName);

        NTStatus lastLoginStatus = NTStatus.STATUS_LOGON_FAILURE;
        Exception? lastConnectError = null;
        var anyConnected = false;
        var attempts = new List<string>();

        foreach (var connectName in connectServerNames)
        {
            var domains = BuildDomainCandidates(normalizedHost, connectName, explicitDomain, netBiosName);
            var connectedWithThisName = false;

            foreach (var domain in domains)
            {
                var client = new SMB2Client();
                try
                {
                    bool isConnected;
                    try
                    {
                        isConnected = client.Connect(connectName, SMBTransportType.DirectTCPTransport);
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
                    connectedWithThisName = true;

                    var loginStatus = client.Login(domain, loginUser, password);
                    lastLoginStatus = loginStatus;
                    if (loginStatus != NTStatus.STATUS_SUCCESS)
                    {
                        attempts.Add($"{connectName}\\{(domain.Length == 0 ? "(boş domain)" : domain)} → {loginStatus}");
                        continue;
                    }

                    try
                    {
                        var fileStore = client.TreeConnect(normalizedShare, out var treeStatus);
                        if (treeStatus != NTStatus.STATUS_SUCCESS || fileStore is null)
                        {
                            throw new SmbNasSessionException(
                                $"Paylaşım adına ({normalizedShare}) bağlanılamadı ({treeStatus}) — adı kontrol edin veya kullanıcının yetkisi olmayabilir.");
                        }

                        try
                        {
                            action(fileStore);
                            return;
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
                            // best-effort
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

            if (connectedWithThisName)
            {
                break;
            }
        }

        if (!anyConnected)
        {
            if (lastConnectError is not null)
            {
                throw new SmbNasSessionException(
                    $"NAS sunucusuna bağlanılamadı ({normalizedHost}): {lastConnectError.Message}");
            }

            throw new SmbNasSessionException(
                $"NAS sunucusuna bağlanılamadı ({normalizedHost}). Adresi ve ağ erişimini kontrol edin.");
        }

        throw new SmbNasSessionException(FormatLoginFailureMessage(lastLoginStatus, netBiosName, attempts));
    }

    private static string FormatLoginFailureMessage(NTStatus status, string? netBiosName, IReadOnlyList<string> attempts)
    {
        var trail = attempts.Count == 0
            ? string.Empty
            : $" Denenen: {string.Join("; ", attempts)}.";

        if (status == NTStatus.STATUS_USER_SESSION_DELETED)
        {
            return "SMB oturumu açılamadı (STATUS_USER_SESSION_DELETED). Kullanıcı adı DOMAIN\\kullanıcı biçiminde deneyin veya NAS workgroup ayarını kontrol edin." + trail;
        }

        if (status is NTStatus.STATUS_LOGON_FAILURE or NTStatus.STATUS_WRONG_PASSWORD)
        {
            var domainHint = netBiosName is not null
                ? $" DOMAIN\\{netBiosName}\\kullanıcı veya {netBiosName}\\kullanıcı biçimini deneyin."
                : " DOMAIN\\kullanıcı biçimini deneyin.";
            return $"Kullanıcı adı veya şifre hatalı ({status}).{domainHint}{trail}";
        }

        return $"NAS kullanıcı girişi başarısız ({status}).{trail}";
    }

    private static IReadOnlyList<string> BuildConnectServerNames(
        string host,
        IPAddress? serverAddress,
        string? netBiosName)
    {
        var candidates = new List<string>();
        void Add(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return;
            }

            var trimmed = value.Trim();
            if (!candidates.Contains(trimmed, StringComparer.OrdinalIgnoreCase))
            {
                candidates.Add(trimmed);
            }
        }

        Add(host);
        Add(netBiosName);
        if (serverAddress is not null && IsIpAddressHost(host))
        {
            Add(TryGetReverseDnsShortName(serverAddress));
        }

        return candidates;
    }

    private static IReadOnlyList<string> BuildDomainCandidates(
        string host,
        string connectName,
        string? explicitDomain,
        string? netBiosName)
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

        Add(explicitDomain);
        Add(string.Empty);
        Add("WORKGROUP");
        Add(netBiosName);
        if (!string.IsNullOrWhiteSpace(connectName) &&
            !IsIpAddressHost(connectName) &&
            !string.Equals(connectName, netBiosName, StringComparison.OrdinalIgnoreCase))
        {
            var connectOnly = connectName.Split(':', StringSplitOptions.TrimEntries)[0];
            var dotIndex = connectOnly.IndexOf('.');
            var shortConnect = dotIndex > 0 ? connectOnly[..dotIndex] : connectOnly;
            Add(shortConnect);
        }

        Add(".");

        if (!IsIpAddressHost(host))
        {
            var hostOnly = host.Split(':', StringSplitOptions.TrimEntries)[0];
            var dotIndex = hostOnly.IndexOf('.');
            var shortHost = dotIndex > 0 ? hostOnly[..dotIndex] : hostOnly;
            Add(shortHost);
        }

        return candidates;
    }

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

    private static IPAddress? ResolveServerAddress(string host)
    {
        var hostOnly = host.Split(':', StringSplitOptions.TrimEntries)[0].Trim();
        if (IPAddress.TryParse(hostOnly, out var parsed))
        {
            return parsed;
        }

        try
        {
            var addresses = Dns.GetHostAddresses(hostOnly);
            return addresses.Length > 0 ? addresses[0] : null;
        }
        catch
        {
            return null;
        }
    }

    private static string? TryGetNetBiosServerName(IPAddress serverAddress)
    {
        try
        {
            var lookup = Task.Run(() =>
            {
                try
                {
                    return new NameServiceClient(serverAddress).GetServerName();
                }
                catch
                {
                    return null;
                }
            });

            if (!lookup.Wait(NetBiosLookupTimeout))
            {
                return null;
            }

            var serverName = lookup.Result;
            return string.IsNullOrWhiteSpace(serverName) ? null : serverName.Trim();
        }
        catch
        {
            return null;
        }
    }

    private static string? TryGetReverseDnsShortName(IPAddress serverAddress)
    {
        try
        {
            var entry = Dns.GetHostEntry(serverAddress);
            var hostName = entry.HostName;
            if (string.IsNullOrWhiteSpace(hostName))
            {
                return null;
            }

            var dotIndex = hostName.IndexOf('.');
            return dotIndex > 0 ? hostName[..dotIndex] : hostName;
        }
        catch
        {
            return null;
        }
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

internal sealed class SmbNasSessionException(string message) : Exception(message);
