namespace CityCommunicationCenter.Shared.Contracts;

public sealed record SendInternalMessageRequest(Guid RecipientUserId, string Content);

public sealed record InternalMessageResponse(
    Guid InternalMessageId,
    Guid SenderUserId,
    string Content,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ReadAtUtc);

public sealed record InternalConversationSummaryResponse(
    Guid InternalConversationId,
    Guid OtherUserId,
    string OtherUserDisplayName,
    string? OtherUserDepartmentName,
    string? LastMessagePreview,
    Guid? LastMessageSenderUserId,
    DateTimeOffset LastMessageAtUtc,
    int UnreadCount);

public sealed record InternalConversationDetailResponse(
    Guid? InternalConversationId,
    Guid OtherUserId,
    string OtherUserDisplayName,
    string? OtherUserDepartmentName,
    IReadOnlyList<InternalMessageResponse> Messages);

public sealed record SendInternalMessageResponse(
    Guid InternalConversationId,
    InternalMessageResponse Message);
