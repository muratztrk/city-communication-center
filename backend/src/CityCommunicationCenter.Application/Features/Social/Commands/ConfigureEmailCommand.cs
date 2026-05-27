namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ConfigureEmailCommand(EmailSettingsRequest Request) : ICommand<SocialSettingsSaveResponse>;

public sealed class ConfigureEmailCommandHandler : ICommandHandler<ConfigureEmailCommand, SocialSettingsSaveResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ConfigureEmailCommandHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<SocialSettingsSaveResponse> Handle(ConfigureEmailCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId) ?? new SocialMediaSettings();
        settings.Email = new EmailSettings
        {
            ImapHost = request.Request.ImapHost,
            ImapPort = request.Request.ImapPort,
            ImapUser = request.Request.ImapUser,
            ImapPassword = request.Request.ImapPassword,
            Folder = request.Request.Folder,
            SmtpHost = request.Request.SmtpHost,
            SmtpPort = request.Request.SmtpPort,
            SmtpUser = request.Request.SmtpUser,
            SmtpPassword = request.Request.SmtpPassword
        };

        await _settingsProvider.SaveSettingsAsync(tenantId, settings, cancellationToken);
        return new SocialSettingsSaveResponse("E-posta ayarlari kaydedildi", true);
    }
}
