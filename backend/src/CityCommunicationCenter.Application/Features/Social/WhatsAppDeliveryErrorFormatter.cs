using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

internal static class WhatsAppDeliveryErrorFormatter
{
    public const string ReEngagementWarning =
        "Vatandaş son 24 saat içinde mesaj göndermediği için yalnızca Meta onaylı şablon mesaj gönderilebilir.";

    public static string Format(string? error)
    {
        if (string.IsNullOrWhiteSpace(error))
        {
            return "Mesaj iletilemedi. Lütfen tekrar deneyin.";
        }

        var normalized = error.Trim();
        var lower = normalized.ToLowerInvariant();

        if (lower.Contains("re-engagement", StringComparison.Ordinal))
        {
            return ReEngagementWarning;
        }

        if (lower.Contains("phone number is malformed", StringComparison.Ordinal)
            || lower.Contains("malformed", StringComparison.Ordinal))
        {
            return "WhatsApp alıcı telefon numarası geçersiz. Numara uluslararası formatta olmalıdır (ör. 905xxxxxxxxx).";
        }

        try
        {
            using var document = JsonDocument.Parse(normalized);
            if (document.RootElement.TryGetProperty("error", out var errorNode))
            {
                if (errorNode.TryGetProperty("error_data", out var errorData)
                    && errorData.TryGetProperty("details", out var details)
                    && details.ValueKind == JsonValueKind.String)
                {
                    var detailText = details.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(detailText))
                    {
                        return detailText;
                    }
                }

                if (errorNode.TryGetProperty("message", out var message)
                    && message.ValueKind == JsonValueKind.String)
                {
                    var messageText = message.GetString()?.Trim();
                    if (!string.IsNullOrWhiteSpace(messageText))
                    {
                        return messageText;
                    }
                }
            }
        }
        catch (JsonException)
        {
            // Plain-text backend errors are shown as-is.
        }

        return normalized;
    }
}
