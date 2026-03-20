namespace CityCommunicationCenter.Shared.Contracts;

public sealed record RoutingConfigResponse(
    bool AutoRoutingEnabled,
    IReadOnlyList<RoutingRuleResponse> Rules);

public sealed record RoutingRuleResponse(
    Guid RuleId,
    string RuleName,
    string Keywords,
    Guid TargetDepartmentId,
    string TargetDepartmentName,
    int Priority,
    bool IsActive);

public sealed record ToggleAutoRoutingRequest(bool Enabled);

public sealed record CreateRoutingRuleRequest(
    string RuleName,
    string Keywords,
    Guid TargetDepartmentId,
    int Priority);

public sealed record UpdateRoutingRuleRequest(
    string RuleName,
    string Keywords,
    Guid TargetDepartmentId,
    int Priority,
    bool IsActive);

public sealed record RoutingTestRequest(string MessageContent);

public sealed record RoutingTestResponse(
    Guid? TargetDepartmentId,
    string? TargetDepartmentName);