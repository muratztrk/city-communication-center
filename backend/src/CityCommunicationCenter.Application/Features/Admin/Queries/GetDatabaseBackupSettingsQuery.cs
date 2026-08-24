namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetDatabaseBackupSettingsQuery(Guid TenantId) : IQuery<DatabaseBackupSettingsResponse?>;

public sealed class GetDatabaseBackupSettingsQueryHandler
    : IQueryHandler<GetDatabaseBackupSettingsQuery, DatabaseBackupSettingsResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantFileStorageSettingsService _settingsService;

    public GetDatabaseBackupSettingsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantFileStorageSettingsService settingsService)
    {
        _dbContext = dbContext;
        _settingsService = settingsService;
    }

    public async ValueTask<DatabaseBackupSettingsResponse?> Handle(
        GetDatabaseBackupSettingsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantExists = await _dbContext.Tenants
            .AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        if (!tenantExists)
        {
            return null;
        }

        var settings = await _settingsService.GetDatabaseBackupSettingsAsync(request.TenantId, cancellationToken);
        return new DatabaseBackupSettingsResponse(
            settings.NasHost,
            settings.NasShareName,
            settings.NasProtocol,
            settings.NasUsername,
            settings.NasHasPassword);
    }
}
