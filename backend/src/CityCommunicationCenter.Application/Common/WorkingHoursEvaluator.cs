namespace CityCommunicationCenter.Application.Common;

public static class WorkingHoursEvaluator
{
    public static bool IsAfterHours(
        WorkingHoursSchedule schedule,
        DateTimeOffset utcNow,
        TimeZoneInfo timeZone)
    {
        if (schedule.IsAlwaysOpen)
        {
            return false;
        }

        var local = TimeZoneInfo.ConvertTime(utcNow, timeZone);
        var day = (int)local.DayOfWeek;
        var daySchedule = schedule.Schedule.FirstOrDefault(item => item.Day == day);
        if (daySchedule is null || string.IsNullOrWhiteSpace(daySchedule.From) || string.IsNullOrWhiteSpace(daySchedule.To))
        {
            return true;
        }

        if (!TimeOnly.TryParse(daySchedule.From, out var from) || !TimeOnly.TryParse(daySchedule.To, out var to))
        {
            return true;
        }

        var now = TimeOnly.FromDateTime(local.DateTime);
        return now < from || now >= to;
    }

    public static WorkingHoursSchedule ResolveSchedule(WorkingHoursDescriptor descriptor, Guid? departmentId)
    {
        if (departmentId is Guid id)
        {
            var overrideSchedule = descriptor.DepartmentOverrides.FirstOrDefault(item => item.DepartmentId == id);
            if (overrideSchedule is not null)
            {
                return new WorkingHoursSchedule(overrideSchedule.IsAlwaysOpen, overrideSchedule.Schedule);
            }
        }

        return descriptor.Default;
    }
}
