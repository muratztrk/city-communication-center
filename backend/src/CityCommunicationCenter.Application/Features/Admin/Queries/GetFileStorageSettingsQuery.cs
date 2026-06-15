namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetFileStorageSettingsQuery(Guid TenantId) : IQuery<FileStorageSettingsResponse?>;

public sealed class GetFileStorageSettingsQueryHandler
    : IQueryHandler<GetFileStorageSettingsQuery, FileStorageSettingsResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantFileStorageSettingsService _settingsService;

    public GetFileStorageSettingsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantFileStorageSettingsService settingsService)
    {
        _dbContext = dbContext;
        _settingsService = settingsService;
    }

    public async ValueTask<FileStorageSettingsResponse?> Handle(
        GetFileStorageSettingsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantExists = await _dbContext.Tenants
            .AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);
        if (!tenantExists)
        {
            return null;
        }

        var settings = await _settingsService.GetSettingsAsync(request.TenantId, cancellationToken);
        return new FileStorageSettingsResponse(
            settings.NasHost,
            settings.NasShareName,
            settings.NasProtocol,
            settings.NasUsername,
            settings.NasHasPassword,
            settings.FtpHost,
            settings.FtpPort,
            settings.FtpPath,
            settings.FtpProtocol,
            settings.FtpUsername,
            settings.FtpHasPassword);
    }
}
