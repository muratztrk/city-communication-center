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

    [Fact]
    public void SelectTemplatesForInbound_PrefersKeywordMatchesOverGeneralTemplate()
    {
        var general = BuildTemplate(
            autoReply: true,
            timedReplyEnabled: true,
            name: "KVKK Hoşgeldiniz");
        general.IsGeneral = true;

        var keyword = BuildTemplate(
            autoReply: true,
            timedReplyEnabled: true,
            hasKeyword: true,
            keywordsJson: "[\"eczane\"]",
            name: "Eczane");
        keyword.IsGeneral = false;
        keyword.Content = "Eczane yanıtı";

        var utcNow = new DateTimeOffset(2026, 6, 26, 20, 0, 0, TimeSpan.Zero);
        var selected = WhatsAppTemplateAutoReply.SelectTemplatesForInbound(
            [general, keyword],
            "Yakın eczane nerede?",
            utcNow,
            Istanbul);

        Assert.Single(selected);
        Assert.Equal("Eczane", selected[0].Name);
    }

    [Fact]
    public void SelectTemplatesForInbound_ReturnsAllMatchingKeywordTemplates()
    {
        var eczane = BuildTemplate(
            autoReply: true,
            timedReplyEnabled: true,
            hasKeyword: true,
            keywordsJson: "[\"eczane\"]",
            name: "Eczane");
        eczane.Content = "Eczane yanıtı";

        var restoran = BuildTemplate(
            autoReply: true,
            timedReplyEnabled: true,
            hasKeyword: true,
            keywordsJson: "[\"tostepe restoran\"]",
            name: "Restoran");
        restoran.Content = "Restoran yanıtı";

        var utcNow = new DateTimeOffset(2026, 6, 26, 20, 0, 0, TimeSpan.Zero);
        var selected = WhatsAppTemplateAutoReply.SelectTemplatesForInbound(
            [eczane, restoran],
            "eczane ve tostepe restoran",
            utcNow,
            Istanbul);

        Assert.Equal(2, selected.Count);
    }

    private static WhatsAppMessageTemplate BuildTemplate(
        bool autoReply,
        bool timedReplyEnabled,
        bool hasKeyword = false,
        string keywordsJson = "[]",
        string startTime = "17:30",
        string endTime = "08:30",
        string name = "Şablon")
    {
        return new WhatsAppMessageTemplate
        {
            Name = name,
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
