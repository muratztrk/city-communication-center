using CityCommunicationCenter.Shared.FileStorage;

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
        string? rootFolder = null,
        CancellationToken cancellationToken = default)
    {
        var normalizedHost = NasPathNormalizer.NormalizeHost(host) ?? host.Trim();
        var normalizedShare = NasPathNormalizer.NormalizeShareName(shareName) ?? shareName.Trim();
        var normalizedRoot = NasPathNormalizer.NormalizeRootFolder(rootFolder);
        return Task.Run(
            () => SmbNasSessionSupport.RunWithInvariantCulture(
                () => SmbNasSessionSupport.TestCreateFolder(
                    normalizedHost,
                    normalizedShare,
                    username,
                    password,
                    normalizedRoot)),
            cancellationToken);
    }
}
