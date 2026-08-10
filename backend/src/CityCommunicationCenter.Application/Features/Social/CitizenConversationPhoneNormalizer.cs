namespace CityCommunicationCenter.Application.Features.Social;

internal static class CitizenConversationPhoneNormalizer
{
    public static string? Normalize(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length == 10)
        {
            return "90" + digits;
        }

        if (digits.Length == 11 && digits.StartsWith('0'))
        {
            return "90" + digits[1..];
        }

        if (digits.Length == 12 && digits.StartsWith("90", StringComparison.Ordinal))
        {
            return digits;
        }

        return digits.Length is >= 10 and <= 15 ? digits : null;
    }

    public static IEnumerable<string> Variants(string normalizedPhone)
    {
        yield return normalizedPhone;
        if (normalizedPhone.Length == 12 && normalizedPhone.StartsWith("90", StringComparison.Ordinal))
        {
            yield return normalizedPhone[2..];
            yield return "0" + normalizedPhone[2..];
        }
    }

    public static bool TryFindConversationId(
        IReadOnlyDictionary<string, Guid> byPhone,
        string normalizedPhone,
        out Guid conversationId)
    {
        foreach (var variant in Variants(normalizedPhone))
        {
            if (byPhone.TryGetValue(variant, out conversationId))
            {
                return true;
            }
        }

        conversationId = default;
        return false;
    }
}
