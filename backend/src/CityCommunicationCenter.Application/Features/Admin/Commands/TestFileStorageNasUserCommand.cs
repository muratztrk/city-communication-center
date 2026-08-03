namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record TestFileStorageNasUserCommand(
    Guid TenantId,
    string Username,
    string Password) : ICommand<NasUserTestResult>;

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

        if (string.IsNullOrWhiteSpace(settings.NasHost) || string.IsNullOrWhiteSpace(settings.NasShareName))
        {
            return new NasUserTestResult(false, "Önce NAS Sunucu Adresi ve Paylaşım Adı'nı kaydedin.");
        }

        if (!string.Equals(settings.NasProtocol, "SMB/CIFS", StringComparison.OrdinalIgnoreCase))
        {
            return new NasUserTestResult(false, "NFS için otomatik klasör testi henüz desteklenmiyor.");
        }

        return await _nasConnectivityTester.TestCreateFolderAsync(
            settings.NasHost.Trim(),
            settings.NasShareName.Trim(),
            request.Username,
            request.Password,
            cancellationToken);
    }
}
