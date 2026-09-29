using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Tests.Features.Social;

public sealed class ConversationEntryOperatorVisibilityTests
{
    [Fact]
    public void IsUndeliveredOutboundForWhatsAppApproval_Pending_ReturnsTrue()
    {
        Assert.True(ConversationEntryOperatorVisibility.IsUndeliveredOutboundForWhatsAppApproval(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            null));
    }

    [Fact]
    public void IsUndeliveredOutboundForWhatsAppApproval_ReEngagementFailed_ReturnsTrue()
    {
        Assert.True(ConversationEntryOperatorVisibility.IsUndeliveredOutboundForWhatsAppApproval(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Failed,
            "Re-engagement message required"));
    }

    [Fact]
    public void IsUndeliveredOutboundForWhatsAppApproval_OtherFailed_ReturnsFalse()
    {
        Assert.False(ConversationEntryOperatorVisibility.IsUndeliveredOutboundForWhatsAppApproval(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Failed,
            "Invalid phone number"));
    }

    [Fact]
    public void IsTerminalPendingAwaitingManagerRelease_ProcessingReceived_IsVisible()
    {
        Assert.False(ConversationEntryOperatorVisibility.IsTerminalPendingAwaitingManagerRelease(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            "Tire Belediyesi · Fen İşleri Müdürlüğü",
            "VT-2026-159 no'lu talebinizin durumu \"İşleme Alındı\".",
            null));
    }

    [Fact]
    public void IsTerminalPendingAwaitingManagerRelease_CompletedWithoutRelease_IsHidden()
    {
        Assert.True(ConversationEntryOperatorVisibility.IsTerminalPendingAwaitingManagerRelease(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            "Tire Belediyesi · Fen İşleri Müdürlüğü",
            "VT-2026-159 no'lu talebinizin durumu \"Tamamlandı\".",
            null));
    }

    [Fact]
    public void CountsForWhatsAppPendingMessageApproval_QueuedProcessingReceived_ReturnsTrue()
    {
        Assert.True(ConversationEntryOperatorVisibility.CountsForWhatsAppPendingMessageApproval(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            null,
            "Tire Belediyesi · Fen İşleri Müdürlüğü",
            "VT-2026-159 no'lu talebinizin durumu \"İşleme Alındı\".",
            null));
    }

    [Fact]
    public void CountsForWhatsAppPendingMessageApproval_TerminalAutomaticWithoutRelease_ReturnsFalse()
    {
        Assert.False(ConversationEntryOperatorVisibility.CountsForWhatsAppPendingMessageApproval(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            null,
            "Tire Belediyesi · Fen İşleri Müdürlüğü",
            "VT-2026-159 no'lu talebinizin durumu \"Tamamlandı\".",
            null));
    }
}
