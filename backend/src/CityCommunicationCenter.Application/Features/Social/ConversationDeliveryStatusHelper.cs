namespace CityCommunicationCenter.Application.Features.Social;

public static class ConversationDeliveryStatusHelper
{
    public static bool TryApply(
        SocialConversationEntry entry,
        ConversationDeliveryStatus newStatus,
        DateTimeOffset statusAtUtc,
        string? errorMessage = null)
    {
        if (entry.Direction != ConversationEntryDirection.Outbound)
        {
            return false;
        }

        if (newStatus == ConversationDeliveryStatus.Failed)
        {
            entry.DeliveryStatus = ConversationDeliveryStatus.Failed;
            entry.DeliveryStatusUpdatedAtUtc = statusAtUtc;
            entry.DeliveryError = string.IsNullOrWhiteSpace(errorMessage) ? entry.DeliveryError : errorMessage.Trim();
            return true;
        }

        if (entry.DeliveryStatus == ConversationDeliveryStatus.Failed)
        {
            return false;
        }

        if (entry.DeliveryStatus.HasValue && Rank(entry.DeliveryStatus.Value) >= Rank(newStatus))
        {
            return false;
        }

        entry.DeliveryStatus = newStatus;
        entry.DeliveryStatusUpdatedAtUtc = statusAtUtc;
        entry.DeliveryError = null;
        return true;
    }

    public static bool TryParseWhatsAppStatus(string? status, out ConversationDeliveryStatus parsed)
    {
        parsed = ConversationDeliveryStatus.Sent;
        if (string.IsNullOrWhiteSpace(status))
        {
            return false;
        }

        return status.ToLowerInvariant() switch
        {
            "sent" => Assign(ConversationDeliveryStatus.Sent, out parsed),
            "delivered" => Assign(ConversationDeliveryStatus.Delivered, out parsed),
            "read" => Assign(ConversationDeliveryStatus.Read, out parsed),
            "failed" => Assign(ConversationDeliveryStatus.Failed, out parsed),
            _ => false,
        };
    }

    private static bool Assign(ConversationDeliveryStatus value, out ConversationDeliveryStatus parsed)
    {
        parsed = value;
        return true;
    }

    private static int Rank(ConversationDeliveryStatus status) => status switch
    {
        ConversationDeliveryStatus.Sent => 1,
        ConversationDeliveryStatus.Delivered => 2,
        ConversationDeliveryStatus.Read => 3,
        ConversationDeliveryStatus.Failed => 4,
        _ => 0,
    };
}
