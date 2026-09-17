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
    public void Municipality_department_header_is_automatic()
    {
        Assert.True(ConversationEntrySenderLabelHelper.IsAutomaticOutbound(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            "Tire Belediyesi · Bilgi İşlem Müdürlüğü",
            "[Dosya eki: logo.png]"));
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

    [Fact]
    public void Bare_tenant_file_attachment_label_is_enriched_with_department()
    {
        var enriched = ConversationEntrySenderLabelHelper.EnrichAutomaticAttachmentSenderLabel(
            ConversationEntryDirection.Outbound,
            "Tire Belediyesi",
            "[Dosya eki: logo.png]",
            "Tire Belediyesi",
            "Bilgi İşlem Müdürlüğü");

        Assert.Equal("Tire Belediyesi · Bilgi İşlem Müdürlüğü", enriched);
    }

    [Fact]
    public void Staff_file_attachment_label_is_not_enriched()
    {
        var enriched = ConversationEntrySenderLabelHelper.EnrichAutomaticAttachmentSenderLabel(
            ConversationEntryDirection.Outbound,
            "Bilgi İşlem Müdürlüğü · Murat Öztürk",
            "[Dosya eki: logo.png]",
            "Tire Belediyesi",
            "Bilgi İşlem Müdürlüğü");

        Assert.Equal("Bilgi İşlem Müdürlüğü · Murat Öztürk", enriched);
    }

    [Theory]
    [InlineData("VT-2026-103 no'lu talep talebinizin durumu \"İptal\".", true)]
    [InlineData("VT-2026-103 no'lu talep talebinizin durumu \"Yapılmakta\".", false)]
    public void Terminal_status_outbound_content_detection(string body, bool expected)
    {
        Assert.Equal(expected, ConversationEntrySenderLabelHelper.IsTerminalCitizenStatusOutboundContent(body));
    }
}
