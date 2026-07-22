using System.Net.Sockets;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record TestFileStorageConnectivityCommand(
    Guid TenantId,
    string? NasHost,
    string? FtpHost,
    int FtpPort) : ICommand<TestFileStorageConnectivityResult>;

public sealed record TestFileStorageConnectivityResult(bool Success, string Message);

public sealed class TestFileStorageConnectivityCommandHandler
    : ICommandHandler<TestFileStorageConnectivityCommand, TestFileStorageConnectivityResult>
{
    public async ValueTask<TestFileStorageConnectivityResult> Handle(
        TestFileStorageConnectivityCommand request,
        CancellationToken cancellationToken)
    {
        var messages = new List<string>();
        var anySuccess = false;
        var anyAttempt = false;

        if (!string.IsNullOrWhiteSpace(request.NasHost))
        {
            anyAttempt = true;
            var nasOk = await TryConnectAsync(request.NasHost.Trim(), 445, cancellationToken);
            messages.Add(nasOk
                ? $"NAS ({request.NasHost.Trim()}:445) erişilebilir."
                : $"NAS ({request.NasHost.Trim()}:445) erişilemedi.");
            anySuccess |= nasOk;
        }

        if (!string.IsNullOrWhiteSpace(request.FtpHost))
        {
            anyAttempt = true;
            var port = request.FtpPort is > 0 and <= 65535 ? request.FtpPort : 21;
            var ftpOk = await TryConnectAsync(request.FtpHost.Trim(), port, cancellationToken);
            messages.Add(ftpOk
                ? $"FTP ({request.FtpHost.Trim()}:{port}) erişilebilir."
                : $"FTP ({request.FtpHost.Trim()}:{port}) erişilemedi.");
            anySuccess |= ftpOk;
        }

        if (!anyAttempt)
        {
            return new TestFileStorageConnectivityResult(false, "Test için NAS veya FTP sunucu adresi girin.");
        }

        return new TestFileStorageConnectivityResult(anySuccess, string.Join(" ", messages));
    }

    private static async Task<bool> TryConnectAsync(string host, int port, CancellationToken cancellationToken)
    {
        try
        {
            using var client = new TcpClient();
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(4));
            await client.ConnectAsync(host, port, timeoutCts.Token);
            return client.Connected;
        }
        catch
        {
            return false;
        }
    }
}
