namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record GetSmsSettingsQuery(Guid TenantId) : IQuery<SmsSettingsResponse?>;

public sealed class GetSmsSettingsQueryHandler : IQueryHandler<GetSmsSettingsQuery, SmsSettingsResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantSmsSettingsService _tenantSmsSettingsService;

    public GetSmsSettingsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantSmsSettingsService tenantSmsSettingsService)
    {
        _dbContext = dbContext;
        _tenantSmsSettingsService = tenantSmsSettingsService;
    }

    public async ValueTask<SmsSettingsResponse?> Handle(GetSmsSettingsQuery request, CancellationToken cancellationToken)
    {
        var tenantExists = await _dbContext.Tenants
            .AnyAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        if (!tenantExists)
        {
            return null;
        }

        var settings = await _tenantSmsSettingsService.GetSettingsAsync(request.TenantId, cancellationToken);

        // Unspecified → FE dropdown placeholder "SMS sağlayıcısı seçiniz" (#6a6efa2c).
        var provider = settings.Provider == SmsProvider.Unspecified
            ? string.Empty
            : settings.Provider.ToString();

        return new SmsSettingsResponse(
            settings.IsEnabled,
            settings.LiveSendEnabled,
            provider,
            settings.ApiUrl,
            settings.Username,
            settings.HasPassword,
            settings.Originator,
            settings.ChargedNumber);
    }
}
