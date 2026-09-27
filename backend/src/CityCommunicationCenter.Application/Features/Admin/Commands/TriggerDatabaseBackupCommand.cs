namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record TriggerDatabaseBackupCommand(Guid TenantId) : ICommand<Unit>;

public sealed class TriggerDatabaseBackupCommandHandler
    : ICommandHandler<TriggerDatabaseBackupCommand, Unit>
{
    private readonly ITenantFileStorageSettingsService _settingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public TriggerDatabaseBackupCommandHandler(
        ITenantFileStorageSettingsService settingsService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _settingsService = settingsService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(TriggerDatabaseBackupCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        if (tenantId != request.TenantId)
        {
            throw new ForbiddenAccessException("Bu işlem için yetkiniz yok.");
        }

        await _settingsService.TriggerImmediateDatabaseBackupAsync(tenantId, cancellationToken);
        return Unit.Value;
    }
}
