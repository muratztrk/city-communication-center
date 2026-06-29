namespace CityCommunicationCenter.Shared.Contracts;

public sealed record UserQuickReplyTemplateResponse(
    Guid TemplateId,
    string Name,
    string Content);

public sealed record UserQuickReplyTemplateRequest(
    string Name,
    string Content);
