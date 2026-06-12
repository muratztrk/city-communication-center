namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CategorizeSocialMessageRequest(
    string Category,
    IReadOnlyCollection<string> Tags);

public sealed record RouteSocialMessageRequest(
    Guid? DepartmentId,
    Guid? UserId);

public sealed record ConvertSocialMessageToJobRequest(
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    string Priority,
    DateTimeOffset? DueDateUtc);

public sealed record CreateSocialMessageRequest(
    string Channel,
    string CitizenHandle,
    string Content,
    string? Category,
    double? Latitude,
    double? Longitude);

public sealed record SocialWebhookRequest(
    string ExternalMessageId,
    string CitizenHandle,
    string Content,
    string Channel,
    DateTimeOffset? ReceivedAtUtc,
    double? Latitude,
    double? Longitude);

public sealed record SocialMessageSummaryResponse(
    Guid SocialMessageId,
    string Channel,
    string CitizenHandle,
    string? Category,
    string Status,
    Guid? AssignedDepartmentId,
    string? AssignedDepartmentName,
    Guid? JobId,
    DateTimeOffset ReceivedAtUtc,
    double? Latitude,
    double? Longitude);

public sealed record SocialMessageDetailResponse(
    Guid SocialMessageId,
    Guid TenantId,
    string Channel,
    string ExternalMessageId,
    string CitizenHandle,
    string Content,
    string? Category,
    string Status,
    Guid? AssignedDepartmentId,
    string? AssignedDepartmentName,
    Guid? JobId,
    DateTimeOffset ReceivedAtUtc,
    double? Latitude,
    double? Longitude,
    IReadOnlyCollection<string> Tags);

public sealed record SocialChannelStatusResponse(
    bool Configured,
    bool HasPrimaryCredential,
    bool HasSecondaryCredential);

public sealed record SocialSettingsStatusResponse(
    SocialChannelStatusResponse X,
    SocialChannelStatusResponse Facebook,
    SocialChannelStatusResponse Instagram,
    SocialChannelStatusResponse WhatsApp,
    SocialChannelStatusResponse EDevlet,
    SocialChannelStatusResponse Email);

public sealed record XSettingsRequest(
    string? ApiKey,
    string? ApiSecret,
    string? AccessToken,
    string? AccessTokenSecret,
    string? BearerToken);

public sealed record FacebookSettingsRequest(
    string? AppId,
    string? AppSecret,
    string? PageAccessToken,
    string? PageId,
    string? WebhookVerifyToken);

public sealed record InstagramSettingsRequest(
    string? AccountId,
    string? AccessToken,
    string? LinkedPageId);

public sealed record WhatsAppSettingsRequest(
    string? BusinessAccountId,
    string? PhoneNumberId,
    string? AccessToken,
    string? AppSecret,
    string? WebhookVerifyToken);

public sealed record EDevletSettingsRequest(
    string? ClientId,
    string? ClientSecret,
    string? RedirectUri,
    string? AuthorizationEndpoint,
    string? TokenEndpoint,
    string? Scope);

public sealed record EmailSettingsRequest(
    string? ImapHost,
    string? ImapPort,
    string? ImapUser,
    string? ImapPassword,
    string? Folder,
    string? SmtpHost,
    string? SmtpPort,
    string? SmtpUser,
    string? SmtpPassword);

public sealed record SocialSettingsSaveResponse(
    string Message,
    bool Configured);

public sealed record SocialConnectionTestResponse(
    string Channel,
    bool Connected,
    string Message);
