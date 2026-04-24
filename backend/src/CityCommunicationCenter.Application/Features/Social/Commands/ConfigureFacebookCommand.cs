namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureFacebookCommand(FacebookSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureFacebookCommandHandler : ICommandHandler<ConfigureFacebookCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConfigureFacebookCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<SocialSettingsSaveResponse> Handle(ConfigureFacebookCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId) ?? new SocialMediaSettings();
        settings.Facebook = new FacebookSettings
        {
            AppId = request.Request.AppId,
            AppSecret = request.Request.AppSecret,
            PageAccessToken = request.Request.PageAccessToken,
            PageId = request.Request.PageId,
            WebhookVerifyToken = request.Request.WebhookVerifyToken
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsSaveResponse("Facebook ayarlari kaydedildi", true);
    }
}