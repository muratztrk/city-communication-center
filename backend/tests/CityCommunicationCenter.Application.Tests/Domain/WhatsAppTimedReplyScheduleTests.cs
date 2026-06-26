using CityCommunicationCenter.Domain;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Tests.Domain;

public sealed class WhatsAppTimedReplyScheduleTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");

    [Fact]
    public void IsActive_ReturnsTrue_WhenTimedReplyDisabled()
    {
        var template = new WhatsAppMessageTemplate { TimedReplyEnabled = false };

        var active = WhatsAppTimedReplySchedule.IsActive(
            template,
            new DateTimeOffset(2026, 6, 15, 12, 0, 0, TimeSpan.Zero),
            Istanbul);

        Assert.True(active);
    }

    [Fact]
    public void IsActive_WeekendAllHours_IgnoresTimeWindowOnSaturday()
    {
        var template = BuildTemplate(
            activeDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            weekendAllHours: true,
            startTime: "17:30",
            endTime: "08:30");

        var saturdayNoon = new DateTimeOffset(2026, 6, 13, 9, 0, 0, TimeSpan.FromHours(3));

        Assert.True(WhatsAppTimedReplySchedule.IsActive(template, saturdayNoon, Istanbul));
    }

    [Fact]
    public void IsActive_WeekdayUsesConfiguredTimeWindow()
    {
        var template = BuildTemplate(
            activeDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
            weekendAllHours: true,
            startTime: "17:30",
            endTime: "08:30");

        var mondayNoon = new DateTimeOffset(2026, 6, 15, 9, 0, 0, TimeSpan.FromHours(3));

        Assert.False(WhatsAppTimedReplySchedule.IsActive(template, mondayNoon, Istanbul));
    }

    [Fact]
    public void IsActive_FiltersByConfiguredDateRange()
    {
        var template = BuildTemplate(
            activeDays: ["monday"],
            startDate: "2026-06-01",
            endDate: "2026-06-10");

        var insideRange = new DateTimeOffset(2026, 6, 8, 10, 0, 0, TimeSpan.FromHours(3));
        var outsideRange = new DateTimeOffset(2026, 6, 15, 10, 0, 0, TimeSpan.FromHours(3));

        Assert.True(WhatsAppTimedReplySchedule.IsActive(template, insideRange, Istanbul));
        Assert.False(WhatsAppTimedReplySchedule.IsActive(template, outsideRange, Istanbul));
    }

    private static WhatsAppMessageTemplate BuildTemplate(
        IReadOnlyList<string> activeDays,
        bool weekendAllHours = false,
        string? startTime = "00:00",
        string? endTime = "23:59",
        string? startDate = null,
        string? endDate = null)
    {
        return new WhatsAppMessageTemplate
        {
            TimedReplyEnabled = true,
            TimedReplyWeekendAllHours = weekendAllHours,
            TimedReplyStartTime = startTime,
            TimedReplyEndTime = endTime,
            TimedReplyStartDate = startDate,
            TimedReplyEndDate = endDate,
            ActiveDaysJson = System.Text.Json.JsonSerializer.Serialize(activeDays),
        };
    }
}
