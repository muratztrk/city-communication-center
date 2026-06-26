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
    DateTimeOffset? DueDateUtc,
    // Vatandaş talebi "Birim Dışı Talep Oluştur" formundan oluşturulduğunda kullanılan ek alanlar (card 443).
    string? RequestType = null,
    IReadOnlyList<Guid>? TargetDepartmentIds = null,
    bool IsProject = false,
    DateTimeOffset? StartDateUtc = null,
    string? Neighborhood = null,
    string? Street = null,
    string? OpenAddress = null,
    string? CitizenName = null,
    string? CitizenPhone = null);

public sealed record CreateSocialMessageRequest(
    string Channel,
    string CitizenHandle,
    string Content,
    string? Category,
    double? Latitude,
    double? Longitude);

public sealed record UpdateSocialMessageRequest(
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
    string? CitizenName,
    string? CitizenPhone,
    string? Content,
    string? Category,
    string Status,
    Guid? AssignedDepartmentId,
    string? AssignedDepartmentName,
    Guid? JobId,
    int? CitizenRequestNumber,
    int? CitizenRequestNumberYear,
    DateTimeOffset ReceivedAtUtc,
    DateTimeOffset? UpdatedAtUtc,
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
    int? CitizenRequestNumber,
    int? CitizenRequestNumberYear,
    DateTimeOffset ReceivedAtUtc,
    DateTimeOffset? UpdatedAtUtc,
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
    SocialChannelStatusResponse Email,
    bool WhatsAppAutoNotify = false,
    WhatsAppPublicSettingsResponse? WhatsAppPublic = null);

public sealed record WhatsAppPublicSettingsResponse(
    string? BusinessAccountId,
    string? PhoneNumberId,
    string? WebhookVerifyToken);

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
    string? WebhookVerifyToken,
    bool AutoNotify = false);

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

public sealed record SocialConversationEntryDto(
    Guid EntryId,
    string Direction,
    string Content,
    string? MediaId,
    string? MediaMimeType,
    DateTimeOffset SentAt);

public sealed record SocialReplyRequest(string Content);

public sealed record CitizenConversationSummaryDto(
    Guid CitizenConversationId,
    string CitizenPhone,
    string? CitizenName,
    DateTimeOffset LastMessageAt,
    int UnreadCount,
    bool IsBlocked,
    string? LastMessagePreview,
    int OpenTicketCount);

public sealed record CitizenConversationDetailDto(
    Guid CitizenConversationId,
    string CitizenPhone,
    string? CitizenName,
    DateTimeOffset LastMessageAt,
    int UnreadCount,
    bool IsBlocked,
    /// <summary>When the last inbound message arrived — used for 24h window check.</summary>
    DateTimeOffset? LastInboundAt,
    IReadOnlyList<CitizenConversationTimelineEntryDto> Timeline,
    IReadOnlyList<CitizenConversationTicketDto> Tickets);

public sealed record CitizenConversationTimelineEntryDto(
    Guid EntryId,
    string Direction,
    string Content,
    string? MediaId,
    string? MediaMimeType,
    DateTimeOffset SentAt,
    Guid SocialMessageId);

public sealed record CitizenConversationTicketDto(
    Guid SocialMessageId,
    string Status,
    DateTimeOffset ReceivedAtUtc,
    Guid? JobId,
    string? Category);

public sealed record WhatsAppMessageTemplateDto(
    Guid TemplateId,
    string Name,
    string Content,
    bool IsActive,
    string Channel,
    bool IsGeneral,
    bool AutoReply,
    int ReplyDelaySecs,
    bool HasKeyword,
    string QueryType,
    IReadOnlyList<string> Keywords,
    bool TimedReplyEnabled,
    string? TimedReplyStartDate,
    string? TimedReplyEndDate,
    string? TimedReplyStartTime,
    string? TimedReplyEndTime,
    IReadOnlyList<string> ActiveDays);

public sealed record WhatsAppMessageTemplateRequest(
    string Name,
    string Content,
    bool IsActive,
    string Channel,
    bool IsGeneral,
    bool AutoReply,
    int ReplyDelaySecs,
    bool HasKeyword,
    string QueryType,
    IReadOnlyList<string> Keywords,
    bool TimedReplyEnabled,
    string? TimedReplyStartDate,
    string? TimedReplyEndDate,
    string? TimedReplyStartTime,
    string? TimedReplyEndTime,
    IReadOnlyList<string> ActiveDays);

public sealed record SocialSettingsSaveResponse(
    string Message,
    bool Configured);

public sealed record SocialConnectionTestResponse(
    string Channel,
    bool Connected,
    string Message);
