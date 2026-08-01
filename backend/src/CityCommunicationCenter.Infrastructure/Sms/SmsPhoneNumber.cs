namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// Her iki sağlayıcı da alıcıyı <c>90XXXXXXXXXX</c> (12 hane) bekliyor; 05XX / 5XX / boşluklu
/// formatlar hata döndürüyor (Asistel EK-A 121/122, jeTTMesaj EK-A 121/122).
/// </summary>
internal static class SmsPhoneNumber
{
    private const string CountryCode = "90";

    /// <summary>Normalize edilemezse <c>null</c> döner (arayan Türkçe hata mesajı üretir).</summary>
    public static string? TryNormalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var digits = new string(value.Where(char.IsDigit).ToArray());

        // 0090555... / +90555... → 90555...
        if (digits.StartsWith("00", StringComparison.Ordinal))
        {
            digits = digits[2..];
        }

        return digits.Length switch
        {
            // 90 5XX XXX XX XX
            12 when digits.StartsWith(CountryCode, StringComparison.Ordinal) => digits,
            // 0 5XX XXX XX XX
            11 when digits.StartsWith("0", StringComparison.Ordinal) => CountryCode + digits[1..],
            // 5XX XXX XX XX
            10 => CountryCode + digits,
            _ => null,
        };
    }
}
