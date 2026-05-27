namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantWorkingHoursService
{
    Task<WorkingHoursDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task SaveSettingsAsync(Guid tenantId, WorkingHoursUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default);
}

public sealed record WorkingHoursDaySchedule(int Day, string? From, string? To);
public sealed record WorkingHoursDepartmentOverride(Guid DepartmentId, string? DepartmentName, bool IsAlwaysOpen, IReadOnlyList<WorkingHoursDaySchedule> Schedule);
public sealed record WorkingHoursSchedule(bool IsAlwaysOpen, IReadOnlyList<WorkingHoursDaySchedule> Schedule);
public sealed record WorkingHoursDescriptor(WorkingHoursSchedule Default, IReadOnlyList<WorkingHoursDepartmentOverride> DepartmentOverrides);
public sealed record WorkingHoursUpdate(WorkingHoursSchedule Default, IReadOnlyList<WorkingHoursDepartmentOverride> DepartmentOverrides);
