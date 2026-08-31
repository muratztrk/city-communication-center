using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Tests.Common;

public sealed class SlaBusinessHoursTests
{
    [Fact]
    public void SundayMorning_Plus48Hours_IsWednesdaySameClock()
    {
        // VT-2026-161: 30.08.2026 08:37 TR (Pazar) → 02.09.2026 08:37 TR (#3281).
        var start = new DateTimeOffset(2026, 8, 30, 8, 37, 0, TimeSpan.FromHours(3));
        var due = SlaBusinessHours.AddExcludingWeekends(start, 48);
        var local = TimeZoneInfo.ConvertTime(due, SlaBusinessHours.TurkeyTimeZone);
        Assert.Equal(new DateTime(2026, 9, 2, 8, 37, 0), local.DateTime);
        Assert.Equal(DayOfWeek.Wednesday, local.DayOfWeek);
    }

    [Fact]
    public void WeekdayStart_DoesNotJumpClock()
    {
        var start = new DateTimeOffset(2026, 8, 31, 8, 37, 0, TimeSpan.FromHours(3)); // Pazartesi
        var due = SlaBusinessHours.AddExcludingWeekends(start, 48);
        var local = TimeZoneInfo.ConvertTime(due, SlaBusinessHours.TurkeyTimeZone);
        Assert.Equal(new DateTime(2026, 9, 2, 8, 37, 0), local.DateTime);
    }

    [Fact]
    public void SaturdayMorning_Plus48Hours_IsWednesdaySameClock()
    {
        var start = new DateTimeOffset(2026, 8, 29, 8, 37, 0, TimeSpan.FromHours(3)); // Cumartesi
        var due = SlaBusinessHours.AddExcludingWeekends(start, 48);
        var local = TimeZoneInfo.ConvertTime(due, SlaBusinessHours.TurkeyTimeZone);
        Assert.Equal(new DateTime(2026, 9, 2, 8, 37, 0), local.DateTime);
        Assert.Equal(DayOfWeek.Wednesday, local.DayOfWeek);
    }
}
