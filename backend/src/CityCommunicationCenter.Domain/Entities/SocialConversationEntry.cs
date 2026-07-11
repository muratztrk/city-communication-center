namespace CityCommunicationCenter.Domain.Entities;

public sealed class SocialConversationEntry
{
    public Guid EntryId { get; set; }

    public Guid SocialMessageId { get; set; }

    public ConversationEntryDirection Direction { get; set; }

    public string Content { get; set; } = string.Empty;

    /// <summary>WhatsApp media object ID — used by the media proxy endpoint to download the file.</summary>
    public string? MediaId { get; set; }

    public string? MediaMimeType { get; set; }

    public DateTimeOffset SentAt { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>WhatsApp message ID (wamid.xxx) for deduplication.</summary>
    public string? ExternalEntryId { get; set; }

    /// <summary>Display label above the message bubble (phone, staff dept/name, municipality).</summary>
    public string? SenderLabel { get; set; }

    /// <summary>WhatsApp delivery lifecycle for outbound messages (sent/delivered/read/failed).</summary>
    public ConversationDeliveryStatus? DeliveryStatus { get; set; }

    public DateTimeOffset? DeliveryStatusUpdatedAtUtc { get; set; }

    public string? DeliveryError { get; set; }

    public DateTimeOffset? EditedAtUtc { get; set; }

    /// <summary>WhatsApp Cloud API template name when outbound was queued/sent as type=template.</summary>
    public string? WhatsAppTemplateName { get; set; }

    /// <summary>WhatsApp Cloud API template language code (e.g. tr).</summary>
    public string? WhatsAppTemplateLanguage { get; set; }

    public SocialMessage SocialMessage { get; set; } = null!;
}
