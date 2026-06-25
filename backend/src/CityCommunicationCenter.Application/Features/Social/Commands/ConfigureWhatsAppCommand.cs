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
        var existing = settings.WhatsApp;

        settings.WhatsApp = new WhatsAppSettings
        {
            BusinessAccountId = SocialSettingsValueMerge.UseIncomingOrExisting(request.Request.BusinessAccountId, existing?.BusinessAccountId),
            PhoneNumberId = SocialSettingsValueMerge.UseIncomingOrExisting(request.Request.PhoneNumberId, existing?.PhoneNumberId),
            AccessToken = SocialSettingsValueMerge.UseIncomingOrExisting(request.Request.AccessToken, existing?.AccessToken),
            AppSecret = SocialSettingsValueMerge.UseIncomingOrExisting(request.Request.AppSecret, existing?.AppSecret),
            WebhookVerifyToken = SocialSettingsValueMerge.UseIncomingOrExisting(request.Request.WebhookVerifyToken, existing?.WebhookVerifyToken),
            AutoNotify = request.Request.AutoNotify
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsSaveResponse("WhatsApp ayarlari kaydedildi", true);
    }
}
