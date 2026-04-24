namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureXCommand(XSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureXCommandHandler : ICommandHandler<ConfigureXCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConfigureXCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<SocialSettingsSaveResponse> Handle(ConfigureXCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId) ?? new SocialMediaSettings();
        settings.X = new XSettings
        {
            ApiKey = request.Request.ApiKey,
            ApiSecret = request.Request.ApiSecret,
            AccessToken = request.Request.AccessToken,
            AccessTokenSecret = request.Request.AccessTokenSecret,
            BearerToken = request.Request.BearerToken
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsSaveResponse("X ayarlari kaydedildi", true);
    }
}