namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetSocialSettingsStatusQuery() : IQuery<SocialSettingsStatusResponse>;

public sealed class GetSocialSettingsStatusQueryHandler : IQueryHandler<GetSocialSettingsStatusQuery, SocialSettingsStatusResponse>
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetSocialSettingsStatusQueryHandler(ISocialMediaSettingsProvider settingsProvider, ITenantContextAccessor tenantContextAccessor)
    {
        _settingsProvider = settingsProvider;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public ValueTask<SocialSettingsStatusResponse> Handle(GetSocialSettingsStatusQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var settings = _settingsProvider.GetSettings(tenantId);

        return ValueTask.FromResult(new SocialSettingsStatusResponse(
            new SocialChannelStatusResponse(
                !string.IsNullOrEmpty(settings?.X?.BearerToken),
                !string.IsNullOrEmpty(settings?.X?.ApiKey),
                !string.IsNullOrEmpty(settings?.X?.AccessToken)),
            new SocialChannelStatusResponse(
                !string.IsNullOrEmpty(settings?.Facebook?.PageAccessToken),
                !string.IsNullOrEmpty(settings?.Facebook?.PageId),
                !string.IsNullOrEmpty(settings?.Facebook?.AppId)),
            new SocialChannelStatusResponse(
                !string.IsNullOrEmpty(settings?.Instagram?.AccessToken),
                !string.IsNullOrEmpty(settings?.Instagram?.AccountId),
                !string.IsNullOrEmpty(settings?.Instagram?.LinkedPageId)),
            new SocialChannelStatusResponse(
                !string.IsNullOrEmpty(settings?.WhatsApp?.AccessToken),
                !string.IsNullOrEmpty(settings?.WhatsApp?.PhoneNumberId),
                !string.IsNullOrEmpty(settings?.WhatsApp?.BusinessAccountId))));
    }
}