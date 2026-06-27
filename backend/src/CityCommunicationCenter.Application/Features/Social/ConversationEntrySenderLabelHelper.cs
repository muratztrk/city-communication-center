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
        var name = string.IsNullOrWhiteSpace(displayName) ? null : displayName.Trim();
        if (dept != null && name != null) return $"{dept} / {name}";
        return name ?? dept ?? "Belediye";
    }

    public static string FormatCitizenRequestNumber(int? number, int? year, DateTimeOffset? fallbackDate)
    {
        var resolvedYear = year ?? fallbackDate?.Year ?? DateTimeOffset.UtcNow.Year;
        return number.HasValue ? $"VT-{resolvedYear}-{number.Value}" : $"VT-{resolvedYear}-Onay Bekleyen";
    }
}
