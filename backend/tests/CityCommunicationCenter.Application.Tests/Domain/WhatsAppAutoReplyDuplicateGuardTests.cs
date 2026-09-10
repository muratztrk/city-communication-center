using CityCommunicationCenter.Domain;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Tests.Domain;

public sealed class WhatsAppAutoReplyDuplicateGuardTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");

    [Fact]
    public void WasTemplateSentOnLocalDay_ReturnsFalse_WhenPreviousSendWasYesterday()
    {
        const string content = "Mesai dışı yanıt";
        var receivedAt = new DateTimeOffset(2026, 6, 27, 20, 0, 0, TimeSpan.Zero);
        var yesterdaySend = new DateTimeOffset(2026, 6, 26, 20, 0, 0, TimeSpan.Zero);

        var sent = WhatsAppAutoReplyDuplicateGuard.WasTemplateSentOnLocalDay(
            [(yesterdaySend, content)],
            content,
            receivedAt,
            Istanbul);

        Assert.False(sent);
    }

    [Fact]
    public void WasTemplateSentOnLocalDay_ReturnsTrue_WhenSameContentSentEarlierSameDay()
    {
        const string content = "Mesai dışı yanıt";
        var receivedAt = new DateTimeOffset(2026, 6, 27, 20, 0, 0, TimeSpan.Zero);
        var earlierSameDay = new DateTimeOffset(2026, 6, 27, 15, 0, 0, TimeSpan.Zero);

        var sent = WhatsAppAutoReplyDuplicateGuard.WasTemplateSentOnLocalDay(
            [(earlierSameDay, content)],
            content,
            receivedAt,
            Istanbul);

        Assert.True(sent);
    }

    [Fact]
    public void TryGetTimedReplyPeriodUtcBounds_uses_same_day_window()
    {
        var template = new WhatsAppMessageTemplate
        {
            TimedReplyEnabled = true,
            TimedReplyStartTime = "09:00",
            TimedReplyEndTime = "17:30",
        };
        var receivedAt = new DateTimeOffset(2026, 9, 10, 10, 0, 0, TimeSpan.FromHours(3));

        var bounds = WhatsAppAutoReplyDuplicateGuard.TryGetTimedReplyPeriodUtcBounds(template, receivedAt, Istanbul);

        Assert.NotNull(bounds);
        var localStart = TimeZoneInfo.ConvertTime(bounds.Value.PeriodStartUtc, Istanbul);
        var localEnd = TimeZoneInfo.ConvertTime(bounds.Value.PeriodEndUtc, Istanbul);
        Assert.Equal(9, localStart.Hour);
        Assert.Equal(17, localEnd.Hour);
        Assert.Equal(30, localEnd.Minute);
    }

    [Fact]
    public void WasTemplateSentInWindow_allows_resend_in_next_period()
    {
        const string content = "Mesai dışı yanıt";
        var template = new WhatsAppMessageTemplate
        {
            TimedReplyEnabled = true,
            TimedReplyStartTime = "17:30",
            TimedReplyEndTime = "08:30",
        };
        var evening = new DateTimeOffset(2026, 9, 10, 18, 0, 0, TimeSpan.FromHours(3));
        var (eveningStart, eveningEnd) = WhatsAppAutoReplyDuplicateGuard.GetDuplicateCheckWindow(template, evening, Istanbul);
        var nextEvening = new DateTimeOffset(2026, 9, 11, 18, 0, 0, TimeSpan.FromHours(3));
        var (nextStart, _) = WhatsAppAutoReplyDuplicateGuard.GetDuplicateCheckWindow(template, nextEvening, Istanbul);

        var sentInFirstPeriod = WhatsAppAutoReplyDuplicateGuard.WasTemplateSentInWindow(
            [(eveningStart.AddMinutes(5), content)],
            content,
            content,
            eveningStart,
            eveningEnd);
        var sentBeforeNextPeriod = WhatsAppAutoReplyDuplicateGuard.WasTemplateSentInWindow(
            [(eveningStart.AddMinutes(5), content)],
            content,
            content,
            nextStart,
            nextStart.AddHours(15));

        Assert.True(sentInFirstPeriod);
        Assert.False(sentBeforeNextPeriod);
    }
}
