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
    public void CountsForWhatsAppPendingMessageApproval_IgnoresClearedTimestampConcept()
    {
        Assert.True(ConversationEntryOperatorVisibility.CountsForWhatsAppPendingMessageApproval(
            ConversationEntryDirection.Outbound,
            ConversationDeliveryStatus.Pending,
            null,
            "Fen İşleri · Ayşe Yılmaz",
            "Merhaba",
            null));
    }
}
