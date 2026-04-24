namespace CityCommunicationCenter.Application.Features.Social;

public sealed record DeleteSocialConfigurationCommand(string Channel) : ICommand<SocialSettingsDeleteResult>;

public sealed class DeleteSocialConfigurationCommandHandler : ICommandHandler<DeleteSocialConfigurationCommand, SocialSettingsDeleteResult>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public DeleteSocialConfigurationCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<SocialSettingsDeleteResult> Handle(DeleteSocialConfigurationCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId);
        if (settings is null)
        {
            return new SocialSettingsDeleteResult(true, false, null);
        }

        switch (request.Channel.ToLowerInvariant())
        {
            case "x":
                settings.X = null;
                break;
            case "facebook":
                settings.Facebook = null;
                break;
            case "instagram":
                settings.Instagram = null;
                break;
            case "whatsapp":
                settings.WhatsApp = null;
                break;
            default:
                return new SocialSettingsDeleteResult(false, true, null);
        }

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsDeleteResult(true, true, new SocialSettingsSaveResponse($"{request.Channel} yapilandirmasi silindi", false));
    }
}