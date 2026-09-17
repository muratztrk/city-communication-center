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

    /// <summary>Otomatik giden durum/ek: "Tire Belediyesi" veya "Tire Belediyesi · Bilgi İşlem Müdürlüğü".</summary>
    public static string FormatAutomaticOutboundSenderLabel(string tenantName, string? departmentNames)
    {
        var name = string.IsNullOrWhiteSpace(tenantName) ? "Belediye" : tenantName.Trim();
        return string.IsNullOrWhiteSpace(departmentNames)
            ? name
            : $"{name} · {departmentNames.Trim()}";
    }

    public static bool IsAutomaticFileAttachmentContent(string? content) =>
        !string.IsNullOrWhiteSpace(content)
        && content.Contains("[Dosya eki:", StringComparison.Ordinal);

    public static string FormatAutomaticAttachmentCaption(int? citizenRequestNumber, int? year, DateTimeOffset? fallbackDate) =>
        $"{FormatCitizenRequestNumber(citizenRequestNumber, year, fallbackDate)} no'lu talebinizin eki gönderilmiştir";

    public static string FormatAutomaticAttachmentContent(
        string fileName,
        int? citizenRequestNumber,
        int? year,
        DateTimeOffset? fallbackDate) =>
        EnsureAutomaticAttachmentCaption(
            $"[Dosya eki: {fileName}]",
            citizenRequestNumber,
            year,
            fallbackDate);

    /// <summary>
    /// Tamamlanma eki gövdesi: <c>VT-2026-121 no'lu talebinizin eki gönderilmiştir</c> + dosya işareti.
    /// Eski <c>… eki</c> başlığı ve yalnız-işaret kayıtlar yeni metne yükseltilir.
    /// </summary>
    public static string EnsureAutomaticAttachmentCaption(
        string? content,
        int? citizenRequestNumber,
        int? year,
        DateTimeOffset? fallbackDate)
    {
        if (string.IsNullOrWhiteSpace(content) || !citizenRequestNumber.HasValue)
        {
            return content ?? string.Empty;
        }

        var caption = FormatAutomaticAttachmentCaption(citizenRequestNumber, year, fallbackDate);
        var trimmed = content.Trim();
        var firstLine = trimmed
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault() ?? trimmed;
        if (string.Equals(firstLine, caption, StringComparison.Ordinal))
        {
            return content;
        }

        var legacyCaption = $"{FormatCitizenRequestNumber(citizenRequestNumber, year, fallbackDate)} no'lu talebinizin eki";
        if (firstLine.StartsWith("[Dosya eki:", StringComparison.OrdinalIgnoreCase))
        {
            return $"{caption}\n{trimmed}";
        }

        if (string.Equals(firstLine, legacyCaption, StringComparison.Ordinal))
        {
            var remainder = trimmed[firstLine.Length..].TrimStart('\r', '\n');
            return string.IsNullOrEmpty(remainder) ? caption : $"{caption}\n{remainder}";
        }

        return content;
    }

    public static string EnrichAutomaticAttachmentCaption(
        ConversationEntryDirection direction,
        string? senderLabel,
        string? content,
        int? citizenRequestNumber,
        int? year,
        DateTimeOffset? fallbackDate)
    {
        if (direction != ConversationEntryDirection.Outbound
            || !IsSystemAutomaticOutboundSenderLabel(senderLabel))
        {
            return content ?? string.Empty;
        }

        return EnsureAutomaticAttachmentCaption(content, citizenRequestNumber, year, fallbackDate);
    }

    /// <summary>
    /// Eski otomatik ek kayıtları yalnız kurum adı taşır; okumada talep birimini ekler.
    /// Personel "Birim · Ad Soyad" etiketine dokunmaz.
    /// </summary>
    public static string EnrichAutomaticAttachmentSenderLabel(
        ConversationEntryDirection direction,
        string? senderLabel,
        string? content,
        string tenantName,
        string? departmentNames)
    {
        var label = string.IsNullOrWhiteSpace(senderLabel) ? tenantName : senderLabel;
        if (direction != ConversationEntryDirection.Outbound
            || string.IsNullOrWhiteSpace(departmentNames)
            || !IsAutomaticFileAttachmentContent(content)
            || label.Contains(" · ", StringComparison.Ordinal))
        {
            return label;
        }

        if (!IsSystemAutomaticOutboundSenderLabel(label)
            && !string.Equals(label, tenantName, StringComparison.Ordinal))
        {
            return label;
        }

        return FormatAutomaticOutboundSenderLabel(tenantName, departmentNames);
    }

    /// <summary>
    /// Kurum içi ileti, personel yanıtı veya telefon kanalı değil; sistem otomatik giden mesaj etiketi
    /// (durum şablonu, zamanlı WA şablon yanıtı — card #2562; kurum · birim #3758).
    /// </summary>
    public static bool IsSystemAutomaticOutboundSenderLabel(string? senderLabel)
    {
        if (string.IsNullOrWhiteSpace(senderLabel)
            || senderLabel.StartsWith("Kurum İçi Mesaj", StringComparison.Ordinal)
            || senderLabel.EndsWith("(Telefon)", StringComparison.Ordinal))
        {
            return false;
        }

        if (!senderLabel.Contains(" · ", StringComparison.Ordinal))
        {
            return true;
        }

        var parts = senderLabel.Split(" · ", StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2)
        {
            return true;
        }

        var first = parts[0];
        var last = parts[^1];
        return first.Contains("Belediye", StringComparison.OrdinalIgnoreCase)
            || last.Contains("Müdürlük", StringComparison.OrdinalIgnoreCase)
            || last.Contains("Başkanlık", StringComparison.OrdinalIgnoreCase)
            || last.Contains(',', StringComparison.Ordinal);
    }

    public static bool LooksLikeCitizenStatusTemplate(string? preview) =>
        !string.IsNullOrWhiteSpace(preview)
        && preview.Contains("talebinizin durumu", StringComparison.OrdinalIgnoreCase);

    public static bool IsTerminalCitizenStatusOutboundContent(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return false;
        }

        string[] terminalStatuses = ["Tamamlandı", "Tamamlanmış", "İptal Edildi", "İptal"];
        foreach (var status in terminalStatuses)
        {
            if (content.Contains($"durumu \"{status}\"", StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

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
