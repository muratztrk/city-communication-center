namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CategorizeSocialMessageRequest(
    string Category,
    IReadOnlyCollection<string> Tags);

public sealed record RouteSocialMessageRequest(
    Guid? DepartmentId,
    Guid? UserId);

public sealed record ConvertSocialMessageToTaskRequest(
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? DueDateUtc);

public sealed record SocialWebhookRequest(
    string ExternalMessageId,
    string CitizenHandle,
    string Content,
    string Channel,
    DateTimeOffset? ReceivedAtUtc);

public sealed record SocialMessageSummaryResponse(
    Guid SocialMessageId,
    string Channel,
    string CitizenHandle,
    string? Category,
    string Status,
    Guid? AssignedDepartmentId,
    Guid? TaskId,
    DateTimeOffset ReceivedAtUtc);

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
    Guid? TaskId,
    DateTimeOffset ReceivedAtUtc,
    IReadOnlyCollection<string> Tags);

public sealed record SocialChannelStatusResponse(
    bool Configured,
    bool HasPrimaryCredential,
    bool HasSecondaryCredential);

public sealed record SocialSettingsStatusResponse(
    SocialChannelStatusResponse X,
    SocialChannelStatusResponse Facebook,
    SocialChannelStatusResponse Instagram,
    SocialChannelStatusResponse WhatsApp);

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
    string? WebhookVerifyToken);

public sealed record SocialSettingsSaveResponse(
    string Message,
    bool Configured);

public sealed record SocialConnectionTestResponse(
    string Channel,
    bool Connected,
    string Message);
