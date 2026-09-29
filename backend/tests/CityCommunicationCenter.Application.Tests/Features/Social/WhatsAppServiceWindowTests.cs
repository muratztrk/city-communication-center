using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class WhatsAppServiceWindowTests
{
    [Fact]
    public void IsWindowOpen_Within24Hours_IsTrue()
    {
        var now = DateTimeOffset.Parse("2026-09-29T09:00:00Z");
        Assert.True(WhatsAppServiceWindow.IsWindowOpen(now.AddHours(-23), now));
    }

    [Fact]
    public void IsWindowOpen_After24Hours_IsFalse()
    {
        var now = DateTimeOffset.Parse("2026-09-29T09:00:00Z");
        Assert.False(WhatsAppServiceWindow.IsWindowOpen(now.AddHours(-24), now));
        Assert.False(WhatsAppServiceWindow.IsWindowOpen(null, now));
    }
}
