using CityCommunicationCenter.Application.Abstractions.SocialMedia;

namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureXCommand(XSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureXCommandHandler : IRequestHandler<ConfigureXCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConfigureXCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<SocialSettingsSaveResponse> Handle(ConfigureXCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
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