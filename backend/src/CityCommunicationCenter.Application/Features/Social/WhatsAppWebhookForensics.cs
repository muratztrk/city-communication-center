using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// WhatsApp webhook iz kaydı. Ham JSON, mesaj metni, medya ve token bu modele girmez.
/// </summary>
public enum WhatsAppWebhookProcessingResult
{
    Created,
    Duplicate,
    IgnoredNoise,
    PhoneNumberMismatch,
    StatusOnly,
    Blocked,
    Failed,
}

public static class WhatsAppWebhookSkipReason
{
    public const string InvalidSignature = "InvalidSignature";
    public const string InvalidJson = "InvalidJson";
    public const string MissingWhatsAppSettings = "MissingWhatsAppSettings";
    public const string PhoneNumberMismatch = "PhoneNumberMismatch";
    public const string AlreadyStored = "AlreadyStored";
    public const string UnsupportedWithoutMedia = "UnsupportedWithoutMedia";
    public const string ConversationBlocked = "ConversationBlocked";
    public const string NoActionableEvents = "NoActionableEvents";
    public const string EntryNotFound = "EntryNotFound";
    public const string UnrecognizedStatus = "UnrecognizedStatus";
    public const string Unchanged = "Unchanged";
    public const string DeliveryFailed = "DeliveryFailed";
    public const string Unhandled = "Unhandled";
}

public readonly record struct WhatsAppWebhookEventHint(
    string EventType,
    string? WabaId,
    string? PhoneNumberId,
    string? MessageId,
    string? SenderMasked,
    string? MessageType);

public static class WhatsAppWebhookForensics
{
    public static string MaskSender(string? sender)
    {
        if (string.IsNullOrWhiteSpace(sender))
        {
            return string.Empty;
        }

        var trimmed = sender.Trim();
        return trimmed.Length <= 4
            ? "****"
            : string.Concat(new string('*', trimmed.Length - 4), trimmed.AsSpan(trimmed.Length - 4));
    }

    public static bool IsPhoneNumberMismatch(string? payloadPhoneNumberId, string? expectedPhoneNumberId)
    {
        if (string.IsNullOrWhiteSpace(payloadPhoneNumberId) ||
            string.IsNullOrWhiteSpace(expectedPhoneNumberId))
        {
            return false;
        }

        return !string.Equals(payloadPhoneNumberId, expectedPhoneNumberId, StringComparison.Ordinal);
    }

    /// <summary>
    /// Reddedilen isteklerde mesaj kimliği ve maskeli gönderen çıkarır. Metin gövdesi dönmez.
    /// </summary>
    public static IReadOnlyList<WhatsAppWebhookEventHint> Enumerate(JsonElement payload)
    {
        var hints = new List<WhatsAppWebhookEventHint>();
        if (!payload.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
        {
            return hints;
        }

        foreach (var entry in entries.EnumerateArray())
        {
            var wabaId = GetString(entry, "id");
            if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var change in changes.EnumerateArray())
            {
                if (!change.TryGetProperty("value", out var value) || value.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                string? phoneNumberId = null;
                if (value.TryGetProperty("metadata", out var metadata))
                {
                    phoneNumberId = GetString(metadata, "phone_number_id");
                }

                var emitted = 0;
                emitted += AppendMessages(hints, value, "messages", "message", "from", wabaId, phoneNumberId);
                emitted += AppendMessages(hints, value, "message_echoes", "echo", "to", wabaId, phoneNumberId);
                emitted += AppendStatuses(hints, value, wabaId, phoneNumberId);
                if (emitted == 0)
                {
                    hints.Add(new WhatsAppWebhookEventHint(
                        "change",
                        wabaId,
                        phoneNumberId,
                        null,
                        null,
                        GetString(change, "field")));
                }
            }
        }

        return hints;
    }

    private static int AppendMessages(
        List<WhatsAppWebhookEventHint> hints,
        JsonElement value,
        string propertyName,
        string eventType,
        string senderProperty,
        string? wabaId,
        string? phoneNumberId)
    {
        if (!value.TryGetProperty(propertyName, out var messages) || messages.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        var count = 0;
        foreach (var message in messages.EnumerateArray())
        {
            hints.Add(new WhatsAppWebhookEventHint(
                eventType,
                wabaId,
                phoneNumberId,
                GetString(message, "id"),
                MaskSender(GetString(message, senderProperty)),
                GetString(message, "type")));
            count++;
        }

        return count;
    }

    private static int AppendStatuses(
        List<WhatsAppWebhookEventHint> hints,
        JsonElement value,
        string? wabaId,
        string? phoneNumberId)
    {
        if (!value.TryGetProperty("statuses", out var statuses) || statuses.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        var count = 0;
        foreach (var status in statuses.EnumerateArray())
        {
            hints.Add(new WhatsAppWebhookEventHint(
                "status",
                wabaId,
                phoneNumberId,
                GetString(status, "id"),
                MaskSender(GetString(status, "recipient_id")),
                GetString(status, "status")));
            count++;
        }

        return count;
    }

    private static string? GetString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
