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
