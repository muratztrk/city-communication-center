namespace CityCommunicationCenter.Infrastructure.SocialMedia;

/// <summary>
/// Common interface for all social media platform clients.
/// Each platform implements this interface to provide unified messaging capabilities.
/// </summary>
public interface ISocialMediaClient
{
    /// <summary>
    /// Platform identifier (e.g., "X", "Facebook", "Instagram", "WhatsApp")
    /// </summary>
    string Platform { get; }

    /// <summary>
    /// Sends a direct message or reply to a user.
    /// </summary>
    Task<SocialMediaResult> SendMessageAsync(SendMessageRequest request, CancellationToken ct = default);

    /// <summary>
    /// Sends a public post/tweet.
    /// </summary>
    Task<SocialMediaResult> PostAsync(PostRequest request, CancellationToken ct = default);

    /// <summary>
    /// Replies to an existing message/post.
    /// </summary>
    Task<SocialMediaResult> ReplyAsync(ReplyRequest request, CancellationToken ct = default);

    /// <summary>
    /// Fetches recent messages/mentions for the authenticated account.
    /// </summary>
    Task<IReadOnlyList<IncomingMessage>> FetchMessagesAsync(FetchMessagesRequest request, CancellationToken ct = default);

    /// <summary>
    /// Gets user profile information.
    /// </summary>
    Task<UserProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default);

    /// <summary>
    /// Validates the client's credentials and connection.
    /// </summary>
    Task<bool> ValidateConnectionAsync(CancellationToken ct = default);
}

#region Request/Response Models

public class SendMessageRequest
{
    public required string RecipientId { get; init; }
    public required string Message { get; init; }
    public List<string>? MediaUrls { get; init; }
}

public class PostRequest
{
    public required string Content { get; init; }
    public List<string>? MediaUrls { get; init; }
    public string? ReplyToPostId { get; init; }
}

public class ReplyRequest
{
    public required string OriginalMessageId { get; init; }
    public required string Content { get; init; }
    public List<string>? MediaUrls { get; init; }
}

public class FetchMessagesRequest
{
    public DateTimeOffset? Since { get; init; }
    public int MaxResults { get; init; } = 100;
    public string? Cursor { get; init; }
}

public class SocialMediaResult
{
    public bool Success { get; init; }
    public string? MessageId { get; init; }
    public string? Error { get; init; }
    public string? ErrorCode { get; init; }

    public static SocialMediaResult Ok(string messageId) => new() { Success = true, MessageId = messageId };
    public static SocialMediaResult Fail(string error, string? code = null) => new() { Success = false, Error = error, ErrorCode = code };
}

public class IncomingMessage
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

public class UserProfile
{
    public required string UserId { get; init; }
    public string? Handle { get; init; }
    public string? DisplayName { get; init; }
    public string? ProfileImageUrl { get; init; }
    public int? FollowersCount { get; init; }
    public bool? IsVerified { get; init; }
}

#endregion
