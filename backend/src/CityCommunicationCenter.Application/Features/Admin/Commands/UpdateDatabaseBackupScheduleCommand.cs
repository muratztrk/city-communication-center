namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateDatabaseBackupScheduleCommand(
    Guid TenantId,
    bool Enabled,
    string? Time,
    int[] Days) : ICommand<Unit>;

public sealed class UpdateDatabaseBackupScheduleCommandHandler
    : ICommandHandler<UpdateDatabaseBackupScheduleCommand, Unit>
{
    private readonly ITenantFileStorageSettingsService _settingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateDatabaseBackupScheduleCommandHandler(
        ITenantFileStorageSettingsService settingsService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _settingsService = settingsService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(
        UpdateDatabaseBackupScheduleCommand request,
        CancellationToken cancellationToken)
    {
        await _settingsService.SaveDatabaseBackupScheduleAsync(
            request.TenantId,
            request.Enabled,
            request.Time,
            request.Days,
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);
        return Unit.Value;
    }
}
