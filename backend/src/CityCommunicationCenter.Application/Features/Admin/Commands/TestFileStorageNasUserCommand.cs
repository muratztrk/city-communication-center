namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record TestFileStorageNasUserCommand(
    Guid TenantId,
    string Username,
    string Password,
    string? NasHost = null,
    string? NasShareName = null,
    string? NasRootFolder = null,
    string? NasProtocol = null) : ICommand<NasUserTestResult>;

public sealed class TestFileStorageNasUserCommandHandler : ICommandHandler<TestFileStorageNasUserCommand, NasUserTestResult>
{
    private readonly ITenantFileStorageSettingsService _fileStorageSettingsService;
    private readonly INasConnectivityTester _nasConnectivityTester;

    public TestFileStorageNasUserCommandHandler(
        ITenantFileStorageSettingsService fileStorageSettingsService,
        INasConnectivityTester nasConnectivityTester)
    {
        _fileStorageSettingsService = fileStorageSettingsService;
        _nasConnectivityTester = nasConnectivityTester;
    }

    public async ValueTask<NasUserTestResult> Handle(TestFileStorageNasUserCommand request, CancellationToken cancellationToken)
    {
        var settings = await _fileStorageSettingsService.GetSettingsAsync(request.TenantId, cancellationToken);

        var nasHost = !string.IsNullOrWhiteSpace(request.NasHost)
            ? request.NasHost
            : settings.NasHost;
        var nasShareName = !string.IsNullOrWhiteSpace(request.NasShareName)
            ? request.NasShareName
            : settings.NasShareName;
        var nasRootFolder = !string.IsNullOrWhiteSpace(request.NasRootFolder)
            ? request.NasRootFolder
            : settings.NasRootFolder;

        if (string.IsNullOrWhiteSpace(nasHost) || string.IsNullOrWhiteSpace(nasShareName))
        {
            return new NasUserTestResult(false, "Önce NAS Sunucu Adresi ve Paylaşım Adı'nı girin veya kaydedin.");
        }

        var nasProtocol = !string.IsNullOrWhiteSpace(request.NasProtocol)
            ? request.NasProtocol.Trim()
            : settings.NasProtocol;

        if (!string.Equals(nasProtocol, "SMB/CIFS", StringComparison.OrdinalIgnoreCase))
        {
            return new NasUserTestResult(false, "NFS için otomatik klasör testi henüz desteklenmiyor.");
        }

        return await _nasConnectivityTester.TestCreateFolderAsync(
            nasHost.Trim(),
            nasShareName.Trim(),
            request.Username,
            request.Password,
            nasRootFolder,
            cancellationToken);
    }
}
