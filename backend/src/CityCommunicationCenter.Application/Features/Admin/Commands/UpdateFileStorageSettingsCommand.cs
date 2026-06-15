namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateFileStorageSettingsCommand(
    Guid TenantId,
    string? NasHost,
    string? NasShareName,
    string NasProtocol,
    string? NasUsername,
    string? NasPassword,
    bool ClearNasPassword,
    string? FtpHost,
    int FtpPort,
    string? FtpPath,
    string FtpProtocol,
    string? FtpUsername,
    string? FtpPassword,
    bool ClearFtpPassword) : ICommand<Unit>;

public sealed class UpdateFileStorageSettingsCommandValidator
    : AbstractValidator<UpdateFileStorageSettingsCommand>
{
    private static readonly string[] NasProtocols = ["SMB/CIFS", "NFS"];
    private static readonly string[] FtpProtocols = ["FTP", "FTPS", "SFTP"];

    public UpdateFileStorageSettingsCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.NasProtocol)
            .Must(NasProtocols.Contains)
            .WithMessage("NAS protocol must be SMB/CIFS or NFS.");
        RuleFor(command => command.FtpProtocol)
            .Must(FtpProtocols.Contains)
            .WithMessage("FTP protocol must be FTP, FTPS, or SFTP.");
        RuleFor(command => command.FtpPort).InclusiveBetween(1, 65535);
    }
}

public sealed class UpdateFileStorageSettingsCommandHandler
    : ICommandHandler<UpdateFileStorageSettingsCommand, Unit>
{
    private readonly ITenantFileStorageSettingsService _settingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateFileStorageSettingsCommandHandler(
        ITenantFileStorageSettingsService settingsService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _settingsService = settingsService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(
        UpdateFileStorageSettingsCommand request,
        CancellationToken cancellationToken)
    {
        await _settingsService.SaveSettingsAsync(
            request.TenantId,
            new TenantFileStorageSettingsUpdate(
                request.NasHost,
                request.NasShareName,
                request.NasProtocol,
                request.NasUsername,
                request.NasPassword,
                request.ClearNasPassword,
                request.FtpHost,
                request.FtpPort,
                request.FtpPath,
                request.FtpProtocol,
                request.FtpUsername,
                request.FtpPassword,
                request.ClearFtpPassword),
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);

        return Unit.Value;
    }
}
