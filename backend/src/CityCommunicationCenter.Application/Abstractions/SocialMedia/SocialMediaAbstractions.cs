namespace CityCommunicationCenter.Application.Abstractions.SocialMedia;

public interface ISocialMediaClient
{
    string Platform { get; }
    Task<SocialMediaResult> SendMessageAsync(SendMessageRequest request, CancellationToken ct = default);
    Task<SocialMediaResult> PostAsync(PostRequest request, CancellationToken ct = default);
    Task<SocialMediaResult> ReplyAsync(ReplyRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<IncomingMessage>> FetchMessagesAsync(FetchMessagesRequest request, CancellationToken ct = default);
    Task<UserProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default);
    Task<bool> ValidateConnectionAsync(CancellationToken ct = default);
}

public interface ISocialMediaClientFactory
{
    ISocialMediaClient? GetClient(SocialChannel channel, Guid tenantId);
    IEnumerable<ISocialMediaClient> GetAllClients(Guid tenantId);
    bool IsChannelConfigured(SocialChannel channel, Guid tenantId);
}

public interface ISocialMediaSettingsProvider
{
    SocialMediaSettings? GetSettings(Guid tenantId);
    Task SaveSettingsAsync(Guid tenantId, SocialMediaSettings settings, CancellationToken ct = default);
}

public sealed class SocialMediaSettings
{
    public XSettings? X { get; set; }
    public FacebookSettings? Facebook { get; set; }
    public InstagramSettings? Instagram { get; set; }
    public WhatsAppSettings? WhatsApp { get; set; }
}

public sealed class XSettings
{
    public string? ApiKey { get; set; }
    public string? ApiSecret { get; set; }
    public string? AccessToken { get; set; }
    public string? AccessTokenSecret { get; set; }
    public string? BearerToken { get; set; }
}

public sealed class FacebookSettings
{
    public string? AppId { get; set; }
    public string? AppSecret { get; set; }
    public string? PageAccessToken { get; set; }
    public string? PageId { get; set; }
    public string? WebhookVerifyToken { get; set; }
}

public sealed class InstagramSettings
{
    public string? AccountId { get; set; }
    public string? AccessToken { get; set; }
    public string? LinkedPageId { get; set; }
}

public sealed class WhatsAppSettings
{
    public string? BusinessAccountId { get; set; }
    public string? PhoneNumberId { get; set; }
    public string? AccessToken { get; set; }
    public string? WebhookVerifyToken { get; set; }
}

public sealed class SendMessageRequest
{
    public required string RecipientId { get; init; }
    public required string Message { get; init; }
    public List<string>? MediaUrls { get; init; }
}

public sealed class PostRequest
{
    public required string Content { get; init; }
    public List<string>? MediaUrls { get; init; }
    public string? ReplyToPostId { get; init; }
}

public sealed class ReplyRequest
{
    public required string OriginalMessageId { get; init; }
    public required string Content { get; init; }
    public List<string>? MediaUrls { get; init; }
}

public sealed class FetchMessagesRequest
{
    public DateTimeOffset? Since { get; init; }
    public int MaxResults { get; init; } = 100;
    public string? Cursor { get; init; }
}

public sealed class SocialMediaResult
{
    public bool Success { get; init; }
    public string? MessageId { get; init; }
    public string? Error { get; init; }
    public string? ErrorCode { get; init; }

    public static SocialMediaResult Ok(string messageId) => new() { Success = true, MessageId = messageId };
    public static SocialMediaResult Fail(string error, string? code = null) => new() { Success = false, Error = error, ErrorCode = code };
}

public sealed class IncomingMessage
{
    public required string MessageId { get; init; }
    public required string SenderId { get; init; }
    public string? SenderHandle { get; init; }
    public string? SenderName { get; init; }
    public required string Content { get; init; }
    public DateTimeOffset ReceivedAt { get; init; }
    public List<string>? MediaUrls { get; init; }
    public string? ReplyToMessageId { get; init; }
    public bool IsDirectMessage { get; init; }
}

public sealed class UserProfile
{
    public required string UserId { get; init; }
    public string? Handle { get; init; }
    public string? DisplayName { get; init; }
    public string? ProfileImageUrl { get; init; }
    public int? FollowersCount { get; init; }
    public bool? IsVerified { get; init; }
}