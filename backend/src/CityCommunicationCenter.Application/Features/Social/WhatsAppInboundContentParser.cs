using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>WhatsApp webhook gelen mesaj gövdesini konuşma kaydı metnine çevirir.</summary>
internal static class WhatsAppInboundContentParser
{
    public static (string Content, string? MediaId, string? MediaMimeType, double? Latitude, double? Longitude) Parse(
        JsonElement message)
    {
        var type = GetString(message, "type") ?? "unknown";

        if (type == "text" && message.TryGetProperty("text", out var text))
        {
            return (GetString(text, "body") ?? "[metin mesajı]", null, null, null, null);
        }

        if (type == "location" && message.TryGetProperty("location", out var location))
        {
            var name = GetString(location, "name");
            var address = GetString(location, "address");
            var latitude = GetDouble(location, "latitude");
            var longitude = GetDouble(location, "longitude");
            var contentText = string.Join(" - ", new[] { name, address }.Where(v => !string.IsNullOrWhiteSpace(v)));
            if (latitude is not null && longitude is not null)
            {
                var coords =
                    $"{latitude.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)},{longitude.Value.ToString(System.Globalization.CultureInfo.InvariantCulture)}";
                contentText = string.IsNullOrWhiteSpace(contentText)
                    ? $"[konum mesajı] {coords}"
                    : $"{contentText}\n[konum mesajı] {coords}";
            }
            else if (string.IsNullOrWhiteSpace(contentText))
            {
                contentText = "[konum mesajı]";
            }

            return (contentText, null, null, latitude, longitude);
        }

        if (type == "reaction" && message.TryGetProperty("reaction", out var reactionObj))
        {
            var emoji = GetString(reactionObj, "emoji");
            return (string.IsNullOrWhiteSpace(emoji) ? "[tepki]" : emoji, null, null, null, null);
        }

        if (type == "interactive" && message.TryGetProperty("interactive", out var interactive))
        {
            if (interactive.TryGetProperty("button_reply", out var btn))
            {
                return (GetString(btn, "title") ?? GetString(btn, "id") ?? "[düğme yanıtı]", null, null, null, null);
            }

            if (interactive.TryGetProperty("list_reply", out var lst))
            {
                return (GetString(lst, "title") ?? GetString(lst, "id") ?? "[liste yanıtı]", null, null, null, null);
            }

            if (interactive.TryGetProperty("nfm_reply", out var nfm))
            {
                var body = GetString(nfm, "body") ?? GetString(nfm, "name");
                return (string.IsNullOrWhiteSpace(body) ? "[form yanıtı]" : body, null, null, null, null);
            }
        }

        if (type == "contacts" && message.TryGetProperty("contacts", out var contactsEl)
            && contactsEl.ValueKind == JsonValueKind.Array)
        {
            var contactLines = FormatWhatsAppContacts(contactsEl);
            var display = string.IsNullOrWhiteSpace(contactLines)
                ? "[kişi kartı]"
                : $"[kişi kartı]\n{contactLines}";
            return (display, null, null, null, null);
        }

        if (message.TryGetProperty(type, out var mediaObj) && mediaObj.ValueKind == JsonValueKind.Object)
        {
            var mediaId = GetString(mediaObj, "id");
            var mimeType = GetString(mediaObj, "mime_type");
            var caption = GetString(mediaObj, "caption");
            var filename = NormalizeInboundMediaFileName(GetString(mediaObj, "filename"));
            string displayContent;
            if (!string.IsNullOrWhiteSpace(filename))
            {
                var marker = $"[Dosya eki: {filename}]";
                displayContent = string.IsNullOrWhiteSpace(caption) ? marker : $"{caption}\n{marker}";
            }
            else
            {
                displayContent = string.IsNullOrWhiteSpace(caption) ? $"[{type}]" : caption;
            }

            return (displayContent, mediaId, mimeType, null, null);
        }

        return ($"[{type}]", null, null, null, null);
    }

    internal static string? NormalizeInboundMediaFileName(string? rawFilename)
    {
        if (string.IsNullOrWhiteSpace(rawFilename)) return null;
        var trimmed = rawFilename.Trim().Trim('"');
        try
        {
            trimmed = Uri.UnescapeDataString(trimmed.Replace('+', ' '));
        }
        catch (UriFormatException)
        {
            // Ham adı koru.
        }

        var name = Path.GetFileName(trimmed.Replace('\\', '/'));
        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }

    internal static string FormatWhatsAppContacts(JsonElement contactsEl)
    {
        var lines = new List<string>();
        foreach (var contact in contactsEl.EnumerateArray())
        {
            string? name = null;
            if (contact.TryGetProperty("name", out var nameObj) && nameObj.ValueKind == JsonValueKind.Object)
            {
                name = GetString(nameObj, "formatted_name");
                if (string.IsNullOrWhiteSpace(name))
                {
                    var first = GetString(nameObj, "first_name");
                    var last = GetString(nameObj, "last_name");
                    name = string.Join(' ', new[] { first, last }.Where(v => !string.IsNullOrWhiteSpace(v)));
                }
            }

            var phones = new List<string>();
            if (contact.TryGetProperty("phones", out var phonesEl) && phonesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var phoneObj in phonesEl.EnumerateArray())
                {
                    if (phoneObj.ValueKind != JsonValueKind.Object) continue;
                    var phone = GetString(phoneObj, "phone") ?? GetString(phoneObj, "wa_id");
                    if (!string.IsNullOrWhiteSpace(phone))
                    {
                        phones.Add(phone.Trim());
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(name) && phones.Count == 0) continue;
            if (string.IsNullOrWhiteSpace(name))
            {
                lines.Add(string.Join('\n', phones));
            }
            else if (phones.Count == 0)
            {
                lines.Add(name.Trim());
            }
            else
            {
                lines.Add($"{name.Trim()}\n{string.Join('\n', phones)}");
            }
        }

        return string.Join("\n\n", lines);
    }

    private static string? GetString(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static double? GetDouble(JsonElement el, string prop)
    {
        if (!el.TryGetProperty(prop, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out var d)) return d;
        if (v.ValueKind == JsonValueKind.String && double.TryParse(v.GetString(),
                System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out d))
        {
            return d;
        }

        return null;
    }
}
