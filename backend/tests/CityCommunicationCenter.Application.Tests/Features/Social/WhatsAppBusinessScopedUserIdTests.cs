using System.Text.Json;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class WhatsAppBusinessScopedUserIdTests
{
    [Theory]
    [InlineData("TR.13491208655302741", true)]
    [InlineData("US.13491208655302741918", true)]
    [InlineData("US.1349.PARENT", true)]
    [InlineData("905453566544", false)]
    [InlineData("tr.short", true)]
    [InlineData("T.1", false)]
    [InlineData("", false)]
    public void IsValid_accepts_country_prefixed_id(string value, bool expected)
    {
        Assert.Equal(expected, WhatsAppBusinessScopedUserId.IsValid(value));
    }

    [Fact]
    public void ResolveHandle_prefers_phone_and_accepts_user_id_when_phone_is_missing()
    {
        Assert.Equal("905453566544", WhatsAppBusinessScopedUserId.ResolveHandle("905453566544", "TR.13491208655302741"));
        Assert.Equal("TR.13491208655302741", WhatsAppBusinessScopedUserId.ResolveHandle(null, "TR.13491208655302741"));
        Assert.Null(WhatsAppBusinessScopedUserId.ResolveHandle(null, "not-an-id"));
    }

    [Fact]
    public void ReadProfileName_uses_contact_name_when_message_has_only_user_id()
    {
        using var document = JsonDocument.Parse("""
            {
              "contacts": [{
                "profile": { "name": "Abdullah Çakar", "username": "ornek" },
                "user_id": "TR.13491208655302741"
              }]
            }
            """);

        var name = WhatsAppBusinessScopedUserId.ReadProfileName(
            document.RootElement,
            phone: null,
            userId: "TR.13491208655302741");

        Assert.Equal("Abdullah Çakar", name);
    }

    [Fact]
    public void FormatCitizenPhone_shows_user_id_as_is_and_keeps_phone_formatting()
    {
        Assert.Equal(
            "TR.1889060825410553",
            ConversationEntrySenderLabelHelper.FormatCitizenPhone("TR.1889060825410553", null));
        Assert.Equal(
            "+90 545 356 65 44",
            ConversationEntrySenderLabelHelper.FormatCitizenPhone("905453566544", null));
    }
}
