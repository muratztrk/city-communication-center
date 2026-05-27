namespace CityCommunicationCenter.Shared.Contracts;

public sealed record WorkingHoursDayScheduleResponse(int Day, string? From, string? To);
public sealed record WorkingHoursDepartmentOverrideResponse(Guid DepartmentId, string? DepartmentName, bool IsAlwaysOpen, IReadOnlyList<WorkingHoursDayScheduleResponse> Schedule);
public sealed record WorkingHoursScheduleResponse(bool IsAlwaysOpen, IReadOnlyList<WorkingHoursDayScheduleResponse> Schedule);
public sealed record WorkingHoursResponse(WorkingHoursScheduleResponse Default, IReadOnlyList<WorkingHoursDepartmentOverrideResponse> DepartmentOverrides);

public sealed record WorkingHoursDayScheduleRequest(int Day, string? From, string? To);
public sealed record WorkingHoursDepartmentOverrideRequest(Guid DepartmentId, string? DepartmentName, bool IsAlwaysOpen, IReadOnlyList<WorkingHoursDayScheduleRequest> Schedule);
public sealed record WorkingHoursScheduleRequest(bool IsAlwaysOpen, IReadOnlyList<WorkingHoursDayScheduleRequest> Schedule);
public sealed record UpdateWorkingHoursRequest(WorkingHoursScheduleRequest Default, IReadOnlyList<WorkingHoursDepartmentOverrideRequest> DepartmentOverrides);
