using CityCommunicationCenter.Application.Features.Admin;

namespace CityCommunicationCenter.Application.Tests.Features.Admin;

public sealed class MailNotificationSettingsPayloadTests
{
    [Fact]
    public void Render_replaces_request_no_token()
    {
        var rendered = MailNotificationSettingsPayload.Render("Talep {TalepNo} geldi.", "VT-2026-9");
        Assert.Equal("Talep VT-2026-9 geldi.", rendered);
    }

    [Fact]
    public void Render_replaces_request_no_and_title_tokens()
    {
        var rendered = MailNotificationSettingsPayload.Render(
            "Merhaba {TalepNo} no'lu {TalepBaşlığı} geldi.",
            "VT-2026-9",
            "Park bakımı");
        Assert.Equal("Merhaba VT-2026-9 no'lu Park bakımı geldi.", rendered);
    }

    [Fact]
    public void Render_replaces_task_no_and_title_tokens()
    {
        var rendered = MailNotificationSettingsPayload.Render(
            "Merhaba {GörevNo} no'lu {GörevBaşlığı} geldi.",
            "VT-2026-9",
            "Park bakımı");
        Assert.Equal("Merhaba VT-2026-9 no'lu Park bakımı geldi.", rendered);
    }

    [Fact]
    public void ToTaskTemplate_rewrites_request_tokens()
    {
        Assert.Equal("{GörevNo}", MailNotificationSettingsPayload.ToTaskTemplate("{TalepNo}"));
        Assert.Equal(
            "{GörevNo} no'lu {GörevBaşlığı}",
            MailNotificationSettingsPayload.ToTaskTemplate("{TalepNo} no'lu {TalepBaşlığı}", withTitleToken: true));
    }

    [Fact]
    public void SplitBody_prefers_title_token()
    {
        var combined = MailNotificationSettingsPayload.CombineBody("Ön ", " sonra");
        var (before, after) = MailNotificationSettingsPayload.SplitBody(combined);
        Assert.Equal("Ön ", before);
        Assert.Equal(" sonra", after);
        Assert.Equal(combined, MailNotificationSettingsPayload.CombineBody(before, after));
    }

    [Fact]
    public void Split_and_combine_roundtrip()
    {
        var combined = MailNotificationSettingsPayload.Combine("Ön ", " sonra");
        var (before, after) = MailNotificationSettingsPayload.Split(combined);
        Assert.Equal("Ön ", before);
        Assert.Equal(" sonra", after);
        Assert.Equal(combined, MailNotificationSettingsPayload.Combine(before, after));
    }
}
