using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class ConversationEntrySenderLabelHelperTests
{
    [Fact]
    public void Automatic_status_template_is_outbound_even_when_delivered()
    {
        Assert.True(ConversationEntrySenderLabelHelper.IsAutomaticOutbound(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Delivered,
            "Tire Belediyesi",
            "VT-2026-150 no'lu sad talebinizin durumu \"İşleme Alındı\"."));
    }

    [Theory]
    [InlineData("İşleme Alındı")]
    [InlineData("Yapılmakta")]
    [InlineData("Tamamlandı")]
    [InlineData("İptal")]
    public void Pending_status_templates_are_automatic(string status)
    {
        Assert.True(ConversationEntrySenderLabelHelper.IsAutomaticOutbound(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            "Tire Belediyesi",
            $"VT-2026-148 no'lu talep talebinizin durumu \"{status}\"."));
    }

    [Fact]
    public void Staff_pending_reply_is_not_automatic()
    {
        Assert.False(ConversationEntrySenderLabelHelper.IsAutomaticOutbound(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            "Özel Kalem Müdürlüğü · Vatandaş O.",
            "sadasd"));
    }
}
