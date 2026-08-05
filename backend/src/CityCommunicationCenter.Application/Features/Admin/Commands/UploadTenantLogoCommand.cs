using CityCommunicationCenter.Application.Features.Attachments;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UploadTenantLogoResponse(string LogoUrl);

public sealed record UploadTenantLogoCommand(
    Guid TenantId,
    TenantLogoKind Kind,
    string FileName,
    long FileSizeBytes,
    Stream FileStream) : ICommand<string>;

public sealed class UploadTenantLogoCommandHandler : ICommandHandler<UploadTenantLogoCommand, string>
{
    private static readonly HashSet<string> AllowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".svg"];
    private const long MaxFileSizeBytes = 2 * 1024 * 1024;

    private readonly string _uploadRootPath;

    public UploadTenantLogoCommandHandler(IOptions<AttachmentStorageOptions> options)
    {
        _uploadRootPath = options.Value.UploadRootPath;
    }

    public async ValueTask<string> Handle(UploadTenantLogoCommand request, CancellationToken cancellationToken)
    {
        var ext = Path.GetExtension(request.FileName).ToLowerInvariant();

        if (!AllowedExtensions.Contains(ext))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.FileName),
                    "Yalnizca resim (JPG, PNG, WEBP, SVG) dosyalari yuklenebilir.")
            ]);
        }

        if (request.FileSizeBytes > MaxFileSizeBytes)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.FileSizeBytes),
                    "Logo dosyasi boyutu 2 MB'i asamaz.")
            ]);
        }

        var (fileBaseName, previousFileBaseName) = request.Kind.GetFileBaseNames();
        var directory = Path.Combine(_uploadRootPath, request.TenantId.ToString(), "branding");
        Directory.CreateDirectory(directory);

        BackupCurrentLogo(directory, fileBaseName, previousFileBaseName);

        foreach (var stale in Directory.EnumerateFiles(directory, $"{fileBaseName}.*")
                     .Where(path => !Path.GetFileName(path).StartsWith($"{previousFileBaseName}.", StringComparison.OrdinalIgnoreCase)))
        {
            File.Delete(stale);
        }

        var storedFileName = $"{fileBaseName}{ext}";
        var physicalPath = Path.Combine(directory, storedFileName);
        await using (var fs = File.Create(physicalPath))
        {
            await request.FileStream.CopyToAsync(fs, cancellationToken);
        }

        return $"/uploads/{request.TenantId}/branding/{storedFileName}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
    }

    private static void BackupCurrentLogo(string directory, string fileBaseName, string previousFileBaseName)
    {
        var currentLogos = Directory.EnumerateFiles(directory, $"{fileBaseName}.*")
            .Where(path => !Path.GetFileName(path).StartsWith($"{previousFileBaseName}.", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (currentLogos.Count == 0)
        {
            return;
        }

        foreach (var stale in Directory.EnumerateFiles(directory, $"{previousFileBaseName}.*"))
        {
            File.Delete(stale);
        }

        var currentLogo = currentLogos[0];
        var backupPath = Path.Combine(directory, $"{previousFileBaseName}{Path.GetExtension(currentLogo)}");
        File.Copy(currentLogo, backupPath, overwrite: true);
    }
}
