using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class CitizenConversationPhoneSelectorTests
{
    [Fact]
    public void PreferCanonical_WhenLocalAndCountryCodeRowsExist_KeepsTheCountryCodeRow()
    {
        var local = Conversation("5551112233");
        var canonical = Conversation("905551112233");

        var chosen = CitizenConversationPhoneSelector.PreferCanonical([local, canonical], "905551112233");

        Assert.Same(canonical, chosen);
    }

    [Fact]
    public void PreferCanonical_WhenOnlyLocalRowExists_ReturnsThatRow()
    {
        var local = Conversation("5551112233");

        var chosen = CitizenConversationPhoneSelector.PreferCanonical([local], "905551112233");

        Assert.Same(local, chosen);
    }

    private static CitizenConversation Conversation(string phone) => new()
    {
        CitizenConversationId = Guid.NewGuid(),
        CitizenPhone = phone,
    };
}
