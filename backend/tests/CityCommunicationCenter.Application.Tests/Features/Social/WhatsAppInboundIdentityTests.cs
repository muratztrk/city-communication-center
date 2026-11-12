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
        var body = Encoding.ASCII.GetBytes(identity);
        var payload = new byte[3 + body.Length + 4];
        payload[0] = 0x1C;
        payload[1] = 0x18;
        payload[2] = (byte)body.Length;
        body.CopyTo(payload, 3);
        return "wamid." + Convert.ToBase64String(payload);
    }
}
