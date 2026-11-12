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

        // Gerçek wamid: 0x1C 0x18 <uzunluk> <kimlik>. Kimlik başta değil.
        if (bytes[0] == 0x1C && bytes[1] == 0x18)
        {
            var length = bytes[2];
            if (length >= 4 && 3 + length <= bytes.Length)
            {
                var prefixed = ReadIdentity(bytes, 3, length);
                if (prefixed is not null)
                {
                    return prefixed;
                }
            }
        }

        return ReadIdentity(bytes, 0, bytes.Length);
    }

    private static string? ReadIdentity(byte[] bytes, int start, int length)
    {
        if (start < 0 || length < 4 || start + length > bytes.Length)
        {
            return null;
        }

        if (bytes[start] is >= (byte)'0' and <= (byte)'9')
        {
            var end = start;
            var limit = start + length;
            while (end < limit && bytes[end] is >= (byte)'0' and <= (byte)'9')
            {
                end++;
            }

            var digitCount = end - start;
            return digitCount is >= 10 and <= 15 && digitCount == length
                ? Encoding.ASCII.GetString(bytes, start, digitCount)
                : null;
        }

        if (length < 4
            || !char.IsLetter((char)bytes[start])
            || !char.IsLetter((char)bytes[start + 1])
            || bytes[start + 2] != (byte)'.')
        {
            return null;
        }

        var identityEnd = start + 3;
        var identityLimit = Math.Min(start + length, start + 128);
        while (identityEnd < identityLimit
            && (char.IsLetterOrDigit((char)bytes[identityEnd]) || bytes[identityEnd] == (byte)'.'))
        {
            identityEnd++;
        }

        if (identityEnd - start != length)
        {
            return null;
        }

        var userId = Encoding.ASCII.GetString(bytes, start, length);
        return WhatsAppBusinessScopedUserId.IsValid(userId) ? userId : null;
    }
}
