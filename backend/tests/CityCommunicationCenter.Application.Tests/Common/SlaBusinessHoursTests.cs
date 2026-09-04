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

    [Fact]
    public void PublicHoliday_IsNonWorkingDay_WhenHolidayExclusionEnabled()
    {
        var holiday = new DateTime(2026, 4, 23, 10, 0, 0); // 23 Nisan
        Assert.True(SlaBusinessHours.IsNonWorkingDay(holiday, excludeWeekends: true, excludePublicHolidays: true));
        Assert.False(SlaBusinessHours.IsNonWorkingDay(holiday, excludeWeekends: true, excludePublicHolidays: false));
    }

    [Fact]
    public void PublicHolidayStart_Plus24Hours_SkipsHoliday()
    {
        // 22 Nisan 2026 Çarşamba 08:37 + 24 iş saati; 23 Nisan tatil sayılmaz → 24 Nisan 08:37.
        var start = new DateTimeOffset(2026, 4, 22, 8, 37, 0, TimeSpan.FromHours(3));
        var due = SlaBusinessHours.AddExcludingNonWorkingDays(start, 24, excludeWeekends: true, excludePublicHolidays: true);
        var local = TimeZoneInfo.ConvertTime(due, SlaBusinessHours.TurkeyTimeZone);
        Assert.Equal(new DateTime(2026, 4, 24, 8, 37, 0), local.DateTime);
        Assert.Equal(DayOfWeek.Friday, local.DayOfWeek);
    }
}
