using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Abstractions;

public sealed record SmsSendContext(
    SmsOutboundKind Kind,
    Guid? JobId = null,
    Guid? SocialMessageId = null,
    Guid? TaskId = null,
    Guid? RecipientUserId = null,
    string? RequestNumber = null);
