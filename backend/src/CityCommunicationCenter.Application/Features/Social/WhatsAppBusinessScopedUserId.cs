using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Meta BSUID: kullanıcı adı olan hesaplarda telefon yerine gelen kimlik (ör. TR.1349…).
/// Olduğu gibi saklanır ve gönderilir; rakama indirgenmez.
/// </summary>
public static class WhatsAppBusinessScopedUserId
{
    public static bool IsValid(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var trimmed = value.Trim();
        if (trimmed.Length is < 4 or > 128 || trimmed.IndexOf('.') != 2)
        {
            return false;
        }

        if (!char.IsLetter(trimmed[0]) || !char.IsLetter(trimmed[1]))
        {
            return false;
        }

        for (var i = 3; i < trimmed.Length; i++)
        {
            var ch = trimmed[i];
            if (!char.IsLetterOrDigit(ch) && ch != '.')
            {
                return false;
            }
        }

        return true;
    }

    public static string? ResolveHandle(string? phone, string? userId)
    {
        if (!string.IsNullOrWhiteSpace(phone))
        {
            return phone.Trim();
        }

        var id = userId?.Trim();
        return IsValid(id) ? id : null;
    }

    public static string? ReadProfileName(JsonElement value, string? phone, string? userId)
    {
        if (!value.TryGetProperty("contacts", out var contacts) || contacts.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        JsonElement? only = null;
        var count = 0;
        foreach (var contact in contacts.EnumerateArray())
        {
            count++;
            only = contact;
            var waId = ReadString(contact, "wa_id");
            var contactUserId = ReadString(contact, "user_id");
            var matchesPhone = !string.IsNullOrWhiteSpace(phone)
                && string.Equals(waId, phone.Trim(), StringComparison.Ordinal);
            var matchesUser = !string.IsNullOrWhiteSpace(userId)
                && string.Equals(contactUserId, userId.Trim(), StringComparison.Ordinal);
            if (matchesPhone || matchesUser)
            {
                return ProfileName(contact);
            }
        }

        return count == 1 && only.HasValue ? ProfileName(only.Value) : null;
    }

    private static string? ProfileName(JsonElement contact)
    {
        if (!contact.TryGetProperty("profile", out var profile))
        {
            return null;
        }

        var name = ReadString(profile, "name");
        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }

    private static string? ReadString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
