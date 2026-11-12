using System.Text;
using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class WhatsAppInboundIdentityTests
{
    [Fact]
    public void FromMessageId_reads_the_phone_that_opened_the_window()
    {
        var identity = WhatsAppInboundIdentity.FromMessageId(Wamid("905301234567"));

        Assert.Equal("905301234567", identity);
    }

    [Fact]
    public void FromMessageId_reads_the_user_id_that_opened_the_window()
    {
        var identity = WhatsAppInboundIdentity.FromMessageId(Wamid("TR.13491208655302741"));

        Assert.Equal("TR.13491208655302741", identity);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-wamid")]
    public void FromMessageId_ignores_ids_without_a_sender(string? externalMessageId)
    {
        Assert.Null(WhatsAppInboundIdentity.FromMessageId(externalMessageId));
    }

    private static string Wamid(string identity)
    {
        var payload = Encoding.ASCII.GetBytes(identity + "\u001cXXXX");
        return "wamid." + Convert.ToBase64String(payload);
    }
}
