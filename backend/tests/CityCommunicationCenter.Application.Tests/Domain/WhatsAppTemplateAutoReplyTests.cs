using CityCommunicationCenter.Domain;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Tests.Domain;

public sealed class WhatsAppTemplateAutoReplyTests
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "Turkey Standard Time" : "Europe/Istanbul");

    [Fact]
    public void IsEligible_ReturnsTrue_WhenTimedAutoReplyIsActiveAndKeywordMatches()
    {
        var template = BuildTemplate(
            autoReply: true,
            timedReplyEnabled: true,
            hasKeyword: true,
            keywordsJson: "[\"mesai\"]",
            startTime: "17:30",
            endTime: "08:30");

        var eligible = WhatsAppTemplateAutoReply.IsEligible(
            template,
            "Mesai saatleriniz nedir?",
            new DateTimeOffset(2026, 6, 26, 20, 0, 0, TimeSpan.Zero),
            Istanbul);

        Assert.True(eligible);
    }

    [Fact]
    public void IsEligible_ReturnsFalse_WhenAutoReplyDisabled()
    {
        var template = BuildTemplate(autoReply: false, timedReplyEnabled: true);

        Assert.False(WhatsAppTemplateAutoReply.IsEligible(
            template,
            "Merhaba",
            DateTimeOffset.UtcNow,
            Istanbul));
    }

    [Fact]
    public void IsEligible_ReturnsFalse_WhenTimedReplyDisabled()
    {
        var template = BuildTemplate(autoReply: true, timedReplyEnabled: false);

        Assert.False(WhatsAppTemplateAutoReply.IsEligible(
            template,
            "Merhaba",
            DateTimeOffset.UtcNow,
            Istanbul));
    }

    [Fact]
    public void IsEligible_ReturnsFalse_WhenKeywordRequiredButMissing()
    {
        var template = BuildTemplate(
            autoReply: true,
            timedReplyEnabled: true,
            hasKeyword: true,
            keywordsJson: "[\"eczane\"]");

        Assert.False(WhatsAppTemplateAutoReply.IsEligible(
            template,
            "Merhaba",
            DateTimeOffset.UtcNow,
            Istanbul));
    }

    private static WhatsAppMessageTemplate BuildTemplate(
        bool autoReply,
        bool timedReplyEnabled,
        bool hasKeyword = false,
        string keywordsJson = "[]",
        string startTime = "17:30",
        string endTime = "08:30")
    {
        return new WhatsAppMessageTemplate
        {
            IsActive = true,
            Channel = "Genel",
            AutoReply = autoReply,
            ReplyDelaySecs = 30,
            TimedReplyEnabled = timedReplyEnabled,
            TimedReplyStartTime = startTime,
            TimedReplyEndTime = endTime,
            ActiveDaysJson = "[\"monday\",\"tuesday\",\"wednesday\",\"thursday\",\"friday\",\"saturday\",\"sunday\"]",
            HasKeyword = hasKeyword,
            KeywordsJson = keywordsJson,
            QueryType = "(LIKE) İçerikte Geçsin",
        };
    }
}
