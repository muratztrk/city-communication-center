using System.Diagnostics;
using System.IO.Compression;
using CityCommunicationCenter.Shared.FileStorage;
using Npgsql;

namespace CityCommunicationCenter.Infrastructure.FileStorage;

/// <summary>
/// Kaydedilen yedek sunucusunda veritabani_yedek klasörünü açar ve gzip pg_dump yazar.
/// </summary>
internal static class DatabaseBackupNasPublisher
{
    public const string BackupFolderName = "veritabani_yedek";

    public static async Task PublishAsync(
        string connectionString,
        string host,
        string shareName,
        string? rootFolder,
        string username,
        string password,
        CancellationToken cancellationToken)
    {
        var dumpPath = await CreateGzipDumpFileAsync(connectionString, cancellationToken);
        try
        {
            var fileName = $"ccc-{DateTime.UtcNow:yyyyMMdd-HHmmss}.sql.gz";
            var relativePath = AttachmentNasPath.ApplyRootFolder($"{BackupFolderName}/{fileName}", rootFolder);
            var smbPath = AttachmentNasPath.ToSmbPath(relativePath);
            SmbNasSessionSupport.ExecuteWithAuthenticatedFileStore(
                host,
                shareName,
                username,
                password,
                fileStore => SmbNasFileOperations.UploadFileFromPath(fileStore, smbPath, dumpPath));
        }
        finally
        {
            TryDelete(dumpPath);
        }
    }

    private static async Task<string> CreateGzipDumpFileAsync(
        string connectionString,
        CancellationToken cancellationToken)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.Host) || string.IsNullOrWhiteSpace(builder.Database))
        {
            throw new FluentValidation.ValidationException("Veritabanı bağlantı dizesi yedek almak için yetersiz.");
        }

        var dumpPath = Path.Combine(Path.GetTempPath(), $"ccc-backup-{Guid.NewGuid():N}.sql.gz");
        var startInfo = new ProcessStartInfo
        {
            FileName = "pg_dump",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        startInfo.ArgumentList.Add("-h");
        startInfo.ArgumentList.Add(builder.Host);
        startInfo.ArgumentList.Add("-p");
        startInfo.ArgumentList.Add((builder.Port == 0 ? 5432 : builder.Port).ToString());
        startInfo.ArgumentList.Add("-U");
        startInfo.ArgumentList.Add(string.IsNullOrWhiteSpace(builder.Username) ? "ccc" : builder.Username);
        startInfo.ArgumentList.Add("-d");
        startInfo.ArgumentList.Add(builder.Database);
        startInfo.ArgumentList.Add("--no-owner");
        startInfo.ArgumentList.Add("--no-privileges");
        if (!string.IsNullOrEmpty(builder.Password))
        {
            startInfo.Environment["PGPASSWORD"] = builder.Password;
        }

        Process? process = null;
        try
        {
            process = Process.Start(startInfo);
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or FileNotFoundException)
        {
            TryDelete(dumpPath);
            throw new FluentValidation.ValidationException("Sunucuda pg_dump bulunamadı. Yedek klasörü oluşturulamadı.");
        }

        if (process is null)
        {
            TryDelete(dumpPath);
            throw new FluentValidation.ValidationException("Veritabanı yedeği başlatılamadı.");
        }

        using (process)
        {
            var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
            await using (var file = new FileStream(dumpPath, FileMode.Create, FileAccess.Write, FileShare.None))
            await using (var gzip = new GZipStream(file, CompressionLevel.SmallestSize))
            {
                await process.StandardOutput.BaseStream.CopyToAsync(gzip, cancellationToken);
            }

            var stderr = await stderrTask;
            await process.WaitForExitAsync(cancellationToken);
            if (process.ExitCode != 0)
            {
                TryDelete(dumpPath);
                var detail = SanitizeDumpError(stderr);
                throw new FluentValidation.ValidationException(
                    string.IsNullOrWhiteSpace(detail)
                        ? "Veritabanı yedeği alınamadı."
                        : $"Veritabanı yedeği alınamadı. {detail}");
            }
        }

        return dumpPath;
    }

    private static string SanitizeDumpError(string? stderr)
    {
        if (string.IsNullOrWhiteSpace(stderr))
        {
            return string.Empty;
        }

        var line = stderr.ReplaceLineEndings(" ").Trim();
        return line.Length <= 240 ? line : line[..240];
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch (IOException)
        {
            // Geçici yedek dosyası silinemese de istek sonucu değişmez.
        }
    }
}
