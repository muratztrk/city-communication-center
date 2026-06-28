using CityCommunicationCenter.Domain;

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
}
