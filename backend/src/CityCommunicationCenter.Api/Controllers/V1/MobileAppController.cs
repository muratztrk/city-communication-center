using System.Text.Json;
using Microsoft.AspNetCore.Authorization;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
[Route("api/v1/mobile-app")]
[AllowAnonymous]
public sealed class MobileAppController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public MobileAppController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("latest")]
    [ProducesResponseType<MobileAppReleaseResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MobileAppReleaseResponse>> GetLatest(
        CancellationToken cancellationToken)
    {
        var releaseDirectory = GetReleaseDirectory();
        var manifestPath = Path.Combine(releaseDirectory, "latest.json");
        if (!System.IO.File.Exists(manifestPath)) return NotFound();

        await using var stream = System.IO.File.OpenRead(manifestPath);
        var manifest = await JsonSerializer.DeserializeAsync<MobileAppReleaseManifest>(
            stream,
            new JsonSerializerOptions(JsonSerializerDefaults.Web),
            cancellationToken);
        if (manifest is null
            || string.IsNullOrWhiteSpace(manifest.Version)
            || manifest.BuildNumber <= 0
            || !IsSafeFileName(manifest.FileName))
        {
            return NotFound();
        }

        var apkPath = Path.Combine(releaseDirectory, manifest.FileName);
        if (!System.IO.File.Exists(apkPath)) return NotFound();

        var downloadUrl = Url.ActionLink(
            nameof(Download),
            values: new { fileName = manifest.FileName },
            protocol: Request.Scheme,
            host: Request.Host.Value);
        if (string.IsNullOrWhiteSpace(downloadUrl)) return NotFound();

        return Ok(new MobileAppReleaseResponse(
            manifest.Version.Trim(),
            manifest.BuildNumber,
            downloadUrl));
    }

    [HttpGet("download/{fileName}")]
    [Produces("application/vnd.android.package-archive")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Download(string fileName)
    {
        if (!IsSafeFileName(fileName)) return NotFound();
        var path = Path.Combine(GetReleaseDirectory(), fileName);
        if (!System.IO.File.Exists(path)) return NotFound();

        return PhysicalFile(
            path,
            "application/vnd.android.package-archive",
            fileName,
            enableRangeProcessing: true);
    }

    private string GetReleaseDirectory() =>
        _configuration["MobileApp:ReleaseDirectory"] ?? "/app/mobile-releases";

    private static bool IsSafeFileName(string? fileName) =>
        !string.IsNullOrWhiteSpace(fileName)
        && string.Equals(fileName, Path.GetFileName(fileName), StringComparison.Ordinal)
        && fileName.EndsWith(".apk", StringComparison.OrdinalIgnoreCase);
}

public sealed record MobileAppReleaseManifest(
    string Version,
    int BuildNumber,
    string FileName);

public sealed record MobileAppReleaseResponse(
    string Version,
    int BuildNumber,
    string DownloadUrl);
