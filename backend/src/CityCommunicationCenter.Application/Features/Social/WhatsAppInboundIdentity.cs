using System.Text;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Meta <c>wamid</c> gövdesinin başı, 24 saatlik pencereyi açan kimliktir:
/// telefon haneleri ya da BSUID (<c>TR.…</c>). Talep formuna yazılan numara bu değildir.
/// </summary>
public static class WhatsAppInboundIdentity
{
    public static string? FromMessageId(string? externalMessageId)
    {
        if (string.IsNullOrWhiteSpace(externalMessageId))
        {
            return null;
        }

        const string prefix = "wamid.";
        if (!externalMessageId.StartsWith(prefix, StringComparison.Ordinal))
        {
            return null;
        }

        byte[] bytes;
        try
        {
            var payload = externalMessageId[prefix.Length..].Replace('-', '+').Replace('_', '/');
            var remainder = payload.Length % 4;
            if (remainder != 0)
            {
                payload = payload.PadRight(payload.Length + (4 - remainder), '=');
            }

            bytes = Convert.FromBase64String(payload);
        }
        catch (FormatException)
        {
            return null;
        }

        if (bytes.Length < 4)
        {
            return null;
        }

        if (bytes[0] is >= (byte)'0' and <= (byte)'9')
        {
            var end = 0;
            while (end < bytes.Length && bytes[end] is >= (byte)'0' and <= (byte)'9')
            {
                end++;
            }

            return end is >= 10 and <= 15
                ? Encoding.ASCII.GetString(bytes, 0, end)
                : null;
        }

        if (!char.IsLetter((char)bytes[0]) || !char.IsLetter((char)bytes[1]) || bytes[2] != (byte)'.')
        {
            return null;
        }

        var identityEnd = 3;
        while (identityEnd < bytes.Length
            && identityEnd < 128
            && (char.IsLetterOrDigit((char)bytes[identityEnd]) || bytes[identityEnd] == (byte)'.'))
        {
            identityEnd++;
        }

        var userId = Encoding.ASCII.GetString(bytes, 0, identityEnd);
        return WhatsAppBusinessScopedUserId.IsValid(userId) ? userId : null;
    }
}
