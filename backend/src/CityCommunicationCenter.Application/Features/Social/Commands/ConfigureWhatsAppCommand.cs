namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureWhatsAppCommand(WhatsAppSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureWhatsAppCommandHandler : ICommandHandler<ConfigureWhatsAppCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConfigureWhatsAppCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<SocialSettingsSaveResponse> Handle(ConfigureWhatsAppCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId) ?? new SocialMediaSettings();
        settings.WhatsApp = new WhatsAppSettings
        {
            BusinessAccountId = request.Request.BusinessAccountId,
            PhoneNumberId = request.Request.PhoneNumberId,
            AccessToken = request.Request.AccessToken,
            AppSecret = request.Request.AppSecret,
            WebhookVerifyToken = request.Request.WebhookVerifyToken
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsSaveResponse("WhatsApp ayarlari kaydedildi", true);
    }
}
