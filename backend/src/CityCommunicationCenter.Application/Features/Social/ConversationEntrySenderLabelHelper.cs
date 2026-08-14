using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

public static class ConversationEntrySenderLabelHelper
{
    public static string FormatCitizenPhone(string? citizenHandle, string? citizenPhone)
    {
        var raw = !string.IsNullOrWhiteSpace(citizenPhone) ? citizenPhone : citizenHandle;
        if (string.IsNullOrWhiteSpace(raw)) return "Vatandaş";

        var trimmed = raw.Trim();
        var atIndex = trimmed.IndexOf('@');
        if (atIndex >= 0) trimmed = trimmed[..atIndex];

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.Length == 12 && digits.StartsWith("90", StringComparison.Ordinal))
        {
            var local = digits[2..];
            return $"+90 {local[..3]} {local[3..6]} {local[6..8]} {local[8..]}";
        }

        if (digits.Length == 10)
        {
            return $"+90 {digits[..3]} {digits[3..6]} {digits[6..8]} {digits[8..]}";
        }

        return trimmed.StartsWith('+') ? trimmed : $"+{digits}";
    }

    public static string FormatStaffLabel(string? departmentName, string? displayName)
    {
        var dept = string.IsNullOrWhiteSpace(departmentName) ? null : departmentName.Trim();
        var fullName = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        if (dept != null && fullName != null) return $"{dept} · {fullName}";
        return fullName ?? dept ?? "Belediye";
    }

    public static string FormatPhoneOutboundLabel(string municipalityName)
    {
        var name = string.IsNullOrWhiteSpace(municipalityName) ? "Belediye" : municipalityName.Trim();
        return $"{name} (Telefon)";
    }

    /// <summary>
    /// Kurum içi ileti, personel yanıtı veya telefon kanalı değil; sistem otomatik giden mesaj etiketi
    /// (durum şablonu, zamanlı WA şablon yanıtı — card #2562).
    /// </summary>
    public static bool IsSystemAutomaticOutboundSenderLabel(string? senderLabel) =>
        !string.IsNullOrWhiteSpace(senderLabel)
        && !senderLabel.StartsWith("Kurum İçi Mesaj", StringComparison.Ordinal)
        && !senderLabel.Contains(" · ")
        && !senderLabel.EndsWith("(Telefon)", StringComparison.Ordinal);

    public static bool LooksLikeCitizenStatusTemplate(string? preview) =>
        !string.IsNullOrWhiteSpace(preview)
        && preview.Contains("talebinizin durumu", StringComparison.OrdinalIgnoreCase);

    public static bool IsAutomaticOutbound(
        ConversationEntryDirection? direction,
        ConversationDeliveryStatus? deliveryStatus,
        string? senderLabel,
        string? preview = null)
    {
        if (direction != ConversationEntryDirection.Outbound) return false;
        if (deliveryStatus == ConversationDeliveryStatus.Failed) return false;
        if (IsSystemAutomaticOutboundSenderLabel(senderLabel)) return true;
        return LooksLikeCitizenStatusTemplate(preview);
    }

    public static bool IsDeliveredAutomaticOutbound(
        string? direction,
        string? deliveryStatus,
        string? senderLabel) =>
        IsAutomaticOutbound(
            Enum.TryParse<ConversationEntryDirection>(direction, true, out var parsedDirection)
                ? parsedDirection
                : null,
            Enum.TryParse<ConversationDeliveryStatus>(deliveryStatus, true, out var parsedStatus)
                ? parsedStatus
                : null,
            senderLabel);

    public static string FormatCitizenRequestNumber(int? number, int? year, DateTimeOffset? fallbackDate)
    {
        var resolvedYear = year ?? fallbackDate?.Year ?? DateTimeOffset.UtcNow.Year;
        return number.HasValue ? $"VT-{resolvedYear}-{number.Value}" : $"VT-{resolvedYear}-Onay Bekleyen";
    }
}
