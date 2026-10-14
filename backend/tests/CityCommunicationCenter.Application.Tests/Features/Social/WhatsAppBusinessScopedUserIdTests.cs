using System.Text.Json;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;

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
    public void ReadContactProfile_reads_username_without_using_it_as_phone()
    {
        using var document = JsonDocument.Parse("""
            {
              "contacts": [{
                "profile": { "name": "Mutlu", "username": "mutlusaray" },
                "user_id": "TR.1564244665448763"
              }]
            }
            """);

        var profile = WhatsAppBusinessScopedUserId.ReadContactProfile(
            document.RootElement,
            phone: null,
            userId: "TR.1564244665448763");

        Assert.Equal("Mutlu", profile.ProfileName);
        Assert.Equal("mutlusaray", profile.Username);
    }

    [Fact]
    public void Apply_keeps_phone_empty_and_maps_whatsapp_identity()
    {
        var conversation = new CitizenConversation();

        WhatsAppCitizenProfile.Apply(
            conversation,
            phone: null,
            userId: "TR.1564244665448763",
            username: "mutlusaray",
            profileName: "Mutlu");

        Assert.Equal(string.Empty, conversation.CitizenPhone);
        Assert.Equal("TR.1564244665448763", conversation.WhatsAppUserId);
        Assert.Equal("mutlusaray", conversation.WhatsAppUsername);
        Assert.Equal("Mutlu", conversation.WhatsAppProfileName);
        Assert.True(string.IsNullOrEmpty(conversation.CitizenName));
    }

    [Fact]
    public void Apply_keeps_a_real_phone_and_still_stores_user_id()
    {
        var conversation = new CitizenConversation { CitizenName = "Operatör adı" };

        WhatsAppCitizenProfile.Apply(
            conversation,
            phone: "905305687744",
            userId: "TR.1564244665448763",
            username: "mutlusaray",
            profileName: "Mutlu");

        Assert.Equal("905305687744", conversation.CitizenPhone);
        Assert.Equal("TR.1564244665448763", conversation.WhatsAppUserId);
        Assert.Equal("mutlusaray", conversation.WhatsAppUsername);
        Assert.Equal("Mutlu", conversation.WhatsAppProfileName);
        Assert.Equal("Operatör adı", conversation.CitizenName);
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
