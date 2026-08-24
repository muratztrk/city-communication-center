namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateDatabaseBackupSettingsCommand(
    Guid TenantId,
    string? NasHost,
    string? NasShareName,
    string NasProtocol,
    string? NasUsername,
    string? NasPassword,
    bool ClearNasPassword) : ICommand<Unit>;

public sealed class UpdateDatabaseBackupSettingsCommandValidator
    : AbstractValidator<UpdateDatabaseBackupSettingsCommand>
{
    private static readonly string[] NasProtocols = ["SMB/CIFS", "NFS"];

    public UpdateDatabaseBackupSettingsCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.NasProtocol)
            .Must(NasProtocols.Contains)
            .WithMessage("NAS protokolü SMB/CIFS veya NFS olmalıdır.");
    }
}

public sealed class UpdateDatabaseBackupSettingsCommandHandler
    : ICommandHandler<UpdateDatabaseBackupSettingsCommand, Unit>
{
    private readonly ITenantFileStorageSettingsService _settingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateDatabaseBackupSettingsCommandHandler(
        ITenantFileStorageSettingsService settingsService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _settingsService = settingsService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(
        UpdateDatabaseBackupSettingsCommand request,
        CancellationToken cancellationToken)
    {
        await _settingsService.SaveDatabaseBackupSettingsAsync(
            request.TenantId,
            new TenantDatabaseBackupSettingsUpdate(
                request.NasHost,
                request.NasShareName,
                request.NasProtocol,
                request.NasUsername,
                request.NasPassword,
                request.ClearNasPassword),
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);

        return Unit.Value;
    }
}
