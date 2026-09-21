using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

internal static class WhatsAppDeliveryErrorFormatter
{
    public const int MaxStoredLength = 500;

    public const string ReEngagementWarning =
        "Vatandaş son 24 saat içinde mesaj göndermediği için yalnızca Meta onaylı şablon mesaj gönderilebilir.";

    /// <summary>Meta hata kodu 130472 — alıcı pazarlama mesajı deney grubunda (#6aa917e4).</summary>
    public const string MarketingExperimentWarning =
        "Bu numara, Meta'nın pazarlama mesajı deney grubunda yer aldığı için mesaj gönderimi kısıtlanmaktadır.";

    /// <summary>DB <c>DeliveryError</c> (max 500) için formatlanmış, kısaltılmış metin.</summary>
    public static string? StoreValue(string? error)
    {
        var formatted = Format(error);
        if (string.IsNullOrWhiteSpace(formatted))
        {
            return null;
        }

        return formatted.Length <= MaxStoredLength
            ? formatted
            : formatted[..MaxStoredLength];
    }

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

        if (IsMarketingExperimentError(lower))
        {
            return MarketingExperimentWarning;
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

    private static bool IsMarketingExperimentError(string lower) =>
        lower.Contains("130472", StringComparison.Ordinal)
        || lower.Contains("part of an experiment", StringComparison.Ordinal)
        || lower.Contains("marketing message experiment", StringComparison.Ordinal);
}
