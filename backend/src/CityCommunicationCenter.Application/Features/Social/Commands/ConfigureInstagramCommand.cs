namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureInstagramCommand(InstagramSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureInstagramCommandHandler : ICommandHandler<ConfigureInstagramCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConfigureInstagramCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<SocialSettingsSaveResponse> Handle(ConfigureInstagramCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId) ?? new SocialMediaSettings();
        settings.Instagram = new InstagramSettings
        {
            AccountId = request.Request.AccountId,
            AccessToken = request.Request.AccessToken,
            LinkedPageId = request.Request.LinkedPageId
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsSaveResponse("Instagram ayarlari kaydedildi", true);
    }
}