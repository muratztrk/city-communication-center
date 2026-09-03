using CityCommunicationCenter.Domain;

namespace CityCommunicationCenter.Application.Tests.Domain;

public sealed class WhatsAppInboundAutoReplyContentTests
{
    [Fact]
    public void PickFromBatch_PrefersLatestMeaningfulTextOverMediaPlaceholder()
    {
        var picked = WhatsAppInboundAutoReplyContent.PickFromBatch(
        [
            "[image]",
            "İyi günler",
        ]);

        Assert.Equal("İyi günler", picked);
    }

    [Fact]
    public void PickFromBatch_FallsBackToLatestWhenOnlyMediaMarkers()
    {
        var picked = WhatsAppInboundAutoReplyContent.PickFromBatch(["[image]", "[document]"]);

        Assert.Equal("[document]", picked);
    }

    [Theory]
    [InlineData("Merhaba", true)]
    [InlineData("[image]", false)]
    [InlineData("Foto\n[image.jpg]", true)]
    public void IsMeaningfulText_ClassifiesInboundContent(string content, bool expected)
    {
        Assert.Equal(expected, WhatsAppInboundAutoReplyContent.IsMeaningfulText(content));
    }
}
