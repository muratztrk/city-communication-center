using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Abstractions;

public sealed record MailSendContext(
    MailOutboundKind Kind,
    Guid? JobId = null,
    Guid? TaskId = null,
    Guid? RecipientUserId = null,
    string? RequestNumber = null);
