using System.Net;
using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

internal static class FtpFileOperations
{
    public static async Task UploadFileAsync(
        FtpAttachmentStorageCredentials credentials,
        string relativePath,
        string localPhysicalPath,
        CancellationToken cancellationToken)
    {
        var segments = relativePath.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0)
        {
            throw new InvalidOperationException("FTP yolu boş.");
        }

        var directoryPath = string.Join('/', segments[..^1]);
        if (!string.IsNullOrWhiteSpace(directoryPath))
        {
            await EnsureDirectoriesAsync(credentials, directoryPath, cancellationToken);
        }

        var targetUri = BuildUri(credentials, relativePath);
        var request = CreateRequest(credentials, targetUri, WebRequestMethods.Ftp.UploadFile);
        var bytes = await File.ReadAllBytesAsync(localPhysicalPath, cancellationToken);
        request.ContentLength = bytes.Length;
        await using var requestStream = await request.GetRequestStreamAsync();
        await requestStream.WriteAsync(bytes, cancellationToken);
        using var response = (FtpWebResponse)await request.GetResponseAsync();
        if (response.StatusCode is not FtpStatusCode.ClosingData and not FtpStatusCode.FileActionOK)
        {
            throw new InvalidOperationException($"FTP yükleme başarısız ({response.StatusCode}).");
        }
    }

    public static async Task<byte[]> DownloadFileAsync(
        FtpAttachmentStorageCredentials credentials,
        string relativePath,
        CancellationToken cancellationToken)
    {
        var targetUri = BuildUri(credentials, relativePath);
        var request = CreateRequest(credentials, targetUri, WebRequestMethods.Ftp.DownloadFile);
        using var response = (FtpWebResponse)await request.GetResponseAsync();
        if (response.StatusCode is not FtpStatusCode.OpeningData
            and not FtpStatusCode.DataAlreadyOpen
            and not FtpStatusCode.ClosingData
            and not FtpStatusCode.FileActionOK)
        {
            throw new InvalidOperationException($"FTP indirme başarısız ({response.StatusCode}).");
        }

        await using var responseStream = response.GetResponseStream()
            ?? throw new InvalidOperationException("FTP yanıt akışı boş.");
        using var buffer = new MemoryStream();
        await responseStream.CopyToAsync(buffer, cancellationToken);
        return buffer.ToArray();
    }

    private static async Task EnsureDirectoriesAsync(
        FtpAttachmentStorageCredentials credentials,
        string directoryPath,
        CancellationToken cancellationToken)
    {
        var current = string.Empty;
        foreach (var segment in directoryPath.Split('/', StringSplitOptions.RemoveEmptyEntries))
        {
            cancellationToken.ThrowIfCancellationRequested();
            current = string.IsNullOrEmpty(current) ? segment : $"{current}/{segment}";
            var uri = BuildUri(credentials, current);
            var request = CreateRequest(credentials, uri, WebRequestMethods.Ftp.MakeDirectory);
            try
            {
                using var response = (FtpWebResponse)await request.GetResponseAsync();
            }
            catch (WebException ex) when (ex.Response is FtpWebResponse ftpResponse
                && ftpResponse.StatusCode is FtpStatusCode.ActionNotTakenFileUnavailable
                    or FtpStatusCode.ActionNotTakenFileUnavailableOrBusy)
            {
                // Klasör zaten var.
            }
        }
    }

    private static Uri BuildUri(FtpAttachmentStorageCredentials credentials, string relativePath)
    {
        var root = (credentials.Path ?? string.Empty).Trim().Trim('/');
        var combined = string.IsNullOrWhiteSpace(root)
            ? relativePath
            : $"{root}/{relativePath.TrimStart('/')}";
        return new Uri($"ftp://{credentials.Host}:{credentials.Port}/{combined}");
    }

    private static FtpWebRequest CreateRequest(
        FtpAttachmentStorageCredentials credentials,
        Uri uri,
        string method)
    {
#pragma warning disable SYSLIB0014
        var request = (FtpWebRequest)WebRequest.Create(uri);
#pragma warning restore SYSLIB0014
        request.Method = method;
        request.Credentials = new NetworkCredential(credentials.Username, credentials.Password);
        request.EnableSsl = credentials.Protocol.Contains("S", StringComparison.OrdinalIgnoreCase);
        request.UsePassive = true;
        request.UseBinary = true;
        request.KeepAlive = false;
        request.Timeout = 20_000;
        return request;
    }
}
