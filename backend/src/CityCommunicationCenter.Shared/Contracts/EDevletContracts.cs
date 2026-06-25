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
    DateTimeOffset CreatedAtUtc);
