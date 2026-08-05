using CityCommunicationCenter.Application.Features.Attachments;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UploadTenantLogoResponse(string LogoUrl);

public sealed record UploadTenantLogoCommand(
    Guid TenantId,
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

        var directory = Path.Combine(_uploadRootPath, request.TenantId.ToString(), "branding");
        Directory.CreateDirectory(directory);

        BackupCurrentLogo(directory);

        // Sabit taban ad ("logo") — eski uzantılı dosyalar birikmesin diye önce temizlenir.
        foreach (var stale in Directory.EnumerateFiles(directory, "logo.*"))
        {
            File.Delete(stale);
        }

        var storedFileName = $"logo{ext}";
        var physicalPath = Path.Combine(directory, storedFileName);
        await using (var fs = File.Create(physicalPath))
        {
            await request.FileStream.CopyToAsync(fs, cancellationToken);
        }

        // Sabit dosya adı tarayıcı önbelleğine takılmasın diye cache-bust query param.
        return $"/uploads/{request.TenantId}/branding/{storedFileName}?v={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
    }

    private static void BackupCurrentLogo(string directory)
    {
        var currentLogos = Directory.EnumerateFiles(directory, "logo.*")
            .Where(path => !Path.GetFileName(path).StartsWith("logo-previous.", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (currentLogos.Count == 0)
        {
            return;
        }

        foreach (var stale in Directory.EnumerateFiles(directory, "logo-previous.*"))
        {
            File.Delete(stale);
        }

        var currentLogo = currentLogos[0];
        var backupPath = Path.Combine(directory, $"logo-previous{Path.GetExtension(currentLogo)}");
        File.Copy(currentLogo, backupPath, overwrite: true);
    }
}
