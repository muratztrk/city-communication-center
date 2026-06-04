namespace CityCommunicationCenter.Shared.Contracts;

public sealed record SlaWeekendSettingsResponse(bool ExcludeWeekends, IReadOnlyList<Guid> ExemptDepartmentIds);
public sealed record UpdateSlaWeekendSettingsRequest(bool ExcludeWeekends, IReadOnlyList<Guid> ExemptDepartmentIds);
