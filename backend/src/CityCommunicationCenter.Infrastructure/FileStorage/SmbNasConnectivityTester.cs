using System.Globalization;
using System.Net;
using System.Net.Sockets;
using CityCommunicationCenter.Shared.FileStorage;
using SMBLibrary;
using SMBLibrary.Client;
using SMBLibrary.NetBios;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

/// <summary>
/// .NET'te native bir SMB istemcisi olmadığı için SMBLibrary (saf C#) kullanılır.
/// SMBLibrary API'si senkron/bloklayan olduğu için çağrı <see cref="Task.Run(Action)"/> içinde yapılır.
/// </summary>
internal sealed class SmbNasConnectivityTester : INasConnectivityTester
{
    private static readonly TimeSpan NetBiosLookupTimeout = TimeSpan.FromSeconds(2);

    public Task<NasUserTestResult> TestCreateFolderAsync(
        string host,
        string shareName,
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        var normalizedHost = NasPathNormalizer.NormalizeHost(host) ?? host.Trim();
        var normalizedShare = NasPathNormalizer.NormalizeShareName(shareName) ?? shareName.Trim();
        return Task.Run(
            () =>
            {
                // İstek kültürü ("tr") Task.Run'a AsyncLocal ile akıyor. SMBLibrary, NTLMv2
                // hesaplamasında kullanıcı adını kültüre duyarlı ToUpper() ile büyütüyor;
                // tr-TR altında 'i' -> 'İ' (noktalı) olup 'I' değil, bu da hash'i bozup
                // doğru parolayla bile STATUS_LOGON_FAILURE üretiyor (canlı QNAP'ta doğrulandı).
                // Bu thread'e özgü olduğu için uygulamanın genel Türkçe lokalizasyonunu etkilemez.
                var previousCulture = CultureInfo.CurrentCulture;
                var previousUiCulture = CultureInfo.CurrentUICulture;
                CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
                CultureInfo.CurrentUICulture = CultureInfo.InvariantCulture;
                try
                {
                    return TestCreateFolder(normalizedHost, normalizedShare, username, password);
                }
                finally
                {
                    CultureInfo.CurrentCulture = previousCulture;
                    CultureInfo.CurrentUICulture = previousUiCulture;
                }
            },
            cancellationToken);
    }

    private static NasUserTestResult TestCreateFolder(
        string host,
        string shareName,
        string username,
        string password)
    {
        var testFolder = $"CCC-Test-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var (explicitDomain, loginUser) = ParseSmbCredentials(username);
        var serverAddress = ResolveServerAddress(host);
        var netBiosName = serverAddress is null ? null : TryGetNetBiosServerName(serverAddress);
        var connectServerNames = BuildConnectServerNames(host, serverAddress, netBiosName);

        NTStatus lastLoginStatus = NTStatus.STATUS_LOGON_FAILURE;
        Exception? lastConnectError = null;
        var anyConnected = false;
        // Hangi bağlantı adı / domain çiftinin denendiği hata mesajına yazılır: aksi halde
        // "kullanıcı adı veya şifre hatalı" mesajı hangi kombinasyonun reddedildiğini gizliyor.
        var attempts = new List<string>();

        foreach (var connectName in connectServerNames)
        {
            var domains = BuildDomainCandidates(host, connectName, explicitDomain, netBiosName);
            var connectedWithThisName = false;

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

            if (connectedWithThisName)
            {
                // Sunucu bu isimle bağlanıp yanıt verdi; tüm domain adayları reddedildiyse
                // sorun isim çözümlemesi değil kimlik/domain. Diğer isimleri denemek yalnızca
                // başarısız deneme sayısını artırır ve QNAP gibi cihazlarda kaynak IP kısıtlanır.
                break;
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

        return new NasUserTestResult(false, FormatLoginFailureMessage(lastLoginStatus, netBiosName, attempts));
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

        // Girilen adres önce denenir: doğru domain adayıyla IP üzerinden SMB2 girişi çalışıyor
        // (canlı NAS'ta doğrulandı) ve isim çözümlemesi gerektirmediği için en hızlı yol budur.
        // NetBIOS / reverse DNS adları yalnızca IP ile giriş reddedilirse yedek olarak denenir (#2347).
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

        // Açık domain (DOMAIN\user / user@domain) önce — kullanıcı bilerek yazdıysa ona uy.
        Add(explicitDomain);

        // Sonra en uyumlu adaylar: yerel NAS hesapları boş domain veya workgroup ile açılır
        // (QNAP/Samba ve Windows yerel hesapları için doğrulandı).
        Add(string.Empty);
        Add("WORKGROUP");

        // NetBIOS makine adı EN SONA: QNAP bu adayı reddediyor ve ilk redden sonra aynı
        // kaynaktan gelen denemeleri düşürdüğü için başa alındığında doğru aday sıra alamıyordu.
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

    /// <summary>
    /// NBSTAT sorgusu UDP/137 üzerinden yapılır; port filtreliyse (Docker, kurumsal firewall)
    /// SMBLibrary'nin çağrısı dakikalarca bloklar ve test isteği asılı kalır. Bu yüzden
    /// arka planda çalıştırılıp kısa bir süre sonra terk edilir — isim yalnızca ek bir adaydır.
    /// </summary>
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
