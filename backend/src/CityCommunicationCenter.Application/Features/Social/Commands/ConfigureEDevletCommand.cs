namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureEDevletCommand(EDevletSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureEDevletCommandHandler : ICommandHandler<ConfigureEDevletCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConfigureEDevletCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
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
            Scope = request.Request.Scope
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsSaveResponse("e-Devlet ayarlari kaydedildi", true);
    }
}
