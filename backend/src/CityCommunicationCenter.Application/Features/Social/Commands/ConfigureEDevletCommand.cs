namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureEDevletCommand(EDevletSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureEDevletCommandHandler : ICommandHandler<ConfigureEDevletCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IApplicationDbContext _dbContext;

    public ConfigureEDevletCommandHandler(
        ISocialMediaSettingsProvider settingsProvider,
        ITenantContextAccessor tenantContextAccessor,
        IApplicationDbContext dbContext)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
        _dbContext = dbContext;
    }

    public async ValueTask<SocialSettingsSaveResponse> Handle(ConfigureEDevletCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId) ?? new SocialMediaSettings();
        settings.EDevlet = new EDevletSettings
        {
            ClientId = request.Request.ClientId,
            ClientSecret = request.Request.ClientSecret,
            RedirectUri = request.Request.RedirectUri,
            AuthorizationEndpoint = request.Request.AuthorizationEndpoint,
            TokenEndpoint = request.Request.TokenEndpoint,
            Scope = request.Request.Scope,
            BelediyeKodu = request.Request.BelediyeKodu,
            SoapKullaniciAdi = request.Request.SoapKullaniciAdi,
            SoapSifre = request.Request.SoapSifre,
            IlceAdi = request.Request.IlceAdi,
            BilgilendirmeMetni = request.Request.BilgilendirmeMetni,
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);

        var tenantSetting = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId, cancellationToken);
        if (tenantSetting is not null)
        {
            tenantSetting.BelediyeKodu = string.IsNullOrWhiteSpace(request.Request.BelediyeKodu)
                ? null
                : request.Request.BelediyeKodu.Trim();
            tenantSetting.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return new SocialSettingsSaveResponse("e-Devlet ayarlari kaydedildi", true);
    }
}
