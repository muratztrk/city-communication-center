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

public sealed record AuditLogResponse(
    Guid AuditLogId,
    Guid TenantId,
    string EntityType,
    string EntityId,
    string Action,
    Guid? ActorUserId,
    DateTimeOffset EventTimeUtc,
    string? Details);

public sealed record MenuVisibilityRule(
    string MenuKey,
    bool IsVisible,
    IReadOnlyList<string>? AllowedRoles,
    IReadOnlyList<Guid>? AllowedDepartmentIds);

public sealed record MenuVisibilitySettingsResponse(
    Guid TenantId,
    IReadOnlyList<MenuVisibilityRule> Rules,
    IReadOnlyList<string> SupportedMenuKeys,
    IReadOnlyList<string> SupportedRoleCodes);

public sealed record UpdateMenuVisibilitySettingsRequest(
    IReadOnlyList<MenuVisibilityRule>? Rules);

public sealed record MenuVisibilityEvaluationResponse(
    IReadOnlyDictionary<string, bool> MenuVisibility);
