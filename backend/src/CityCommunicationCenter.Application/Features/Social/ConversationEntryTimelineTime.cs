namespace CityCommunicationCenter.Application.Features.Social;

internal static class ConversationEntryTimelineTime
{
    private static readonly TimeSpan LegacyQueuedGapThreshold = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Konuşma sıralaması ve balon saati: bekleyen giden mesajlar kuyruk anında;
    /// iletilmiş giden mesajlar gerçek gönderim saatinde (SentAt veya eski kayıtlar için
    /// DeliveryStatusUpdatedAtUtc, #3627).
    /// </summary>
    public static DateTimeOffset ResolveSortKey(
        ConversationEntryDirection direction,
        DateTimeOffset sentAt,
        ConversationDeliveryStatus? deliveryStatus,
        DateTimeOffset? deliveryStatusUpdatedAtUtc)
    {
        if (direction == ConversationEntryDirection.Inbound)
        {
            return sentAt;
        }

        if (deliveryStatus is ConversationDeliveryStatus.Pending or ConversationDeliveryStatus.Failed)
        {
            return sentAt;
        }

        if (deliveryStatusUpdatedAtUtc.HasValue
            && deliveryStatusUpdatedAtUtc.Value > sentAt.Add(LegacyQueuedGapThreshold))
        {
            return deliveryStatusUpdatedAtUtc.Value;
        }

        return sentAt;
    }
}
