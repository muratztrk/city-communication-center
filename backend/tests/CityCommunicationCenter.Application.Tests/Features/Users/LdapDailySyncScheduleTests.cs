using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Tests.Features.Users;

public class LdapDailySyncScheduleTests
{
    private static readonly TimeZoneInfo Turkey = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");

    [Fact]
    public void ShouldRun_False_WhenDisabledOrMissingTime()
    {
        var now = new DateTimeOffset(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);
        Assert.False(LdapDailySyncSchedule.ShouldRun(now, Turkey, false, "02:00", null));
        Assert.False(LdapDailySyncSchedule.ShouldRun(now, Turkey, true, null, null));
        Assert.False(LdapDailySyncSchedule.ShouldRun(now, Turkey, true, "bad", null));
    }

    [Fact]
    public void ShouldRun_False_BeforeScheduledTurkeyTime()
    {
        // 01:30 TR = 22:30 previous day UTC (UTC+3).
        var now = new DateTimeOffset(2026, 8, 31, 22, 30, 0, TimeSpan.Zero);
        Assert.False(LdapDailySyncSchedule.ShouldRun(now, Turkey, true, "02:00", null));
    }

    [Fact]
    public void ShouldRun_True_AfterScheduledTime_OncePerTurkeyDate()
    {
        var now = new DateTimeOffset(2026, 8, 31, 23, 5, 0, TimeSpan.Zero); // 02:05 TR
        Assert.True(LdapDailySyncSchedule.ShouldRun(now, Turkey, true, "02:00", null));
        Assert.False(LdapDailySyncSchedule.ShouldRun(now, Turkey, true, "02:00", "2026-09-01"));
    }
}
