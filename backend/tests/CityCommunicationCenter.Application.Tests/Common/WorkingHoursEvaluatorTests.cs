using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Tests.Common;

public sealed class WorkingHoursEvaluatorTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");

    private static WorkingHoursSchedule Weekdays() => new(
        false,
        [
            new WorkingHoursDaySchedule(1, "08:30", "17:30"),
            new WorkingHoursDaySchedule(2, "08:30", "17:30"),
            new WorkingHoursDaySchedule(3, "08:30", "17:30"),
            new WorkingHoursDaySchedule(4, "08:30", "17:30"),
            new WorkingHoursDaySchedule(5, "08:30", "17:30"),
            new WorkingHoursDaySchedule(6, null, null),
            new WorkingHoursDaySchedule(0, null, null),
        ]);

    [Fact]
    public void IsAfterHours_Weekend_IsTrue()
    {
        var saturdayNoonUtc = new DateTimeOffset(2026, 8, 22, 9, 0, 0, TimeSpan.Zero);
        Assert.True(WorkingHoursEvaluator.IsAfterHours(Weekdays(), saturdayNoonUtc, Istanbul));
    }

    [Fact]
    public void IsAfterHours_WeekdayMorning_IsFalse()
    {
        var wednesdayMorningUtc = new DateTimeOffset(2026, 8, 19, 7, 0, 0, TimeSpan.Zero);
        Assert.False(WorkingHoursEvaluator.IsAfterHours(Weekdays(), wednesdayMorningUtc, Istanbul));
    }

    [Fact]
    public void IsAfterHours_AlwaysOpen_IsFalse()
    {
        var schedule = new WorkingHoursSchedule(true, []);
        Assert.False(WorkingHoursEvaluator.IsAfterHours(schedule, DateTimeOffset.UtcNow, Istanbul));
    }
}
