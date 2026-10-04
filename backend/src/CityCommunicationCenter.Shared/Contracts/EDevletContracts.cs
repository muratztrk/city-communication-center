namespace CityCommunicationCenter.Shared.Contracts;

public sealed record EDevletActivityTypeResponse(
    Guid ActivityTypeId,
    string Name,
    int SortOrder);

public sealed record CreateEDevletActivityTypeRequest(string Name);

public sealed record UpdateEDevletActivityTypeRequest(string Name);

public sealed record CreateEDevletDailyActivityPlanRequest(
    Guid ActivityTypeId,
    string Description,
    string? Neighborhood,
    string? Street,
    string? OpenAddress);

public sealed record EDevletDailyActivityPlanResponse(
    Guid PlanId,
    Guid ActivityTypeId,
    string ActivityTypeName,
    string Description,
    string? Neighborhood,
    string? Street,
    string? OpenAddress,
    int? PlanNumber,
    int? PlanNumberYear,
    string Status,
    DateTimeOffset CreatedAtUtc,
    string? CreatedByDisplayName = null,
    string? DepartmentName = null,
    IReadOnlyList<EDevletDailyActivityPlanEditResponse>? Edits = null);

public sealed record EDevletDailyActivityPlanEditResponse(
    string? EditedByDisplayName,
    DateTimeOffset EditedAtUtc,
    IReadOnlyList<string> ChangedFields);

public sealed record UpdateEDevletDailyActivityPlanRequest(
    Guid ActivityTypeId,
    string Description,
    string? Neighborhood,
    string? Street,
    string? OpenAddress,
    string? Status = null);

public sealed record EDevletDailyActivityPlanListItemResponse(
    Guid PlanId,
    int? PlanNumber,
    int? PlanNumberYear,
    DateTimeOffset CreatedAtUtc,
    string ActivityTypeName,
    string? Neighborhood,
    string? Street,
    string Description,
    string Status);
