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

    public readonly record struct WhatsAppContactProfile(string? ProfileName, string? Username);

    public static WhatsAppContactProfile ReadContactProfile(JsonElement value, string? phone, string? userId)
    {
        if (!value.TryGetProperty("contacts", out var contacts) || contacts.ValueKind != JsonValueKind.Array)
        {
            return default;
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
                return ToContactProfile(contact);
            }
        }

        return count == 1 && only.HasValue ? ToContactProfile(only.Value) : default;
    }

    public static string? ReadProfileName(JsonElement value, string? phone, string? userId)
        => ReadContactProfile(value, phone, userId).ProfileName;

    private static WhatsAppContactProfile ToContactProfile(JsonElement contact)
    {
        if (!contact.TryGetProperty("profile", out var profile))
        {
            return default;
        }

        var name = ReadString(profile, "name");
        var username = ReadString(profile, "username");
        return new WhatsAppContactProfile(
            string.IsNullOrWhiteSpace(name) ? null : name.Trim(),
            string.IsNullOrWhiteSpace(username) ? null : username.Trim());
    }

    private static string? ReadString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
