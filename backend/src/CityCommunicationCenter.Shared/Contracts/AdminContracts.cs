namespace CityCommunicationCenter.Shared.Contracts;

public sealed record TenantSettingsResponse(
    Guid TenantId,
    string DisplayName,
    string? Theme,
    string? Domain,
    int DefaultSlaHours);

public sealed record UpdateTenantSettingsRequest(
    string DisplayName,
    string? Theme,
    string? Domain,
    int DefaultSlaHours);

public sealed record PublishWorkflowRequest(
    string WorkflowName,
    int Version,
    string? Description);

public sealed record PublishWorkflowAcceptedResponse(
    string Message,
    string WorkflowName,
    int Version,
    string? Description);

public sealed record AuditLogResponse(
    Guid AuditLogId,
    Guid TenantId,
    string EntityType,
    string EntityId,
    string Action,
    Guid? ActorUserId,
    DateTimeOffset EventTimeUtc,
    string? Details);
