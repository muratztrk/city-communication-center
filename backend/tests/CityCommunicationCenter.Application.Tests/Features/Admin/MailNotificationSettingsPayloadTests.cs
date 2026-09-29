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
    public void Split_and_combine_roundtrip()
    {
        var combined = MailNotificationSettingsPayload.Combine("Ön ", " sonra");
        var (before, after) = MailNotificationSettingsPayload.Split(combined);
        Assert.Equal("Ön ", before);
        Assert.Equal(" sonra", after);
        Assert.Equal(combined, MailNotificationSettingsPayload.Combine(before, after));
    }
}
