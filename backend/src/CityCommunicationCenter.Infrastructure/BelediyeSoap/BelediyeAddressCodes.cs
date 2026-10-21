using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace CityCommunicationCenter.Infrastructure.BelediyeSoap;

/// <summary>
/// mahalle/sokak-cadde kodlari: ad listesindeki sirayi degil, adin kendisini tasir; yeni bir ad eklendiginde
/// daha once verilmis kodlar kaymaz ve basvuruYap'taki kod tekrar ada cevrilebilir.
/// </summary>
public static partial class BelediyeAddressCodes
{
    public static string Encode(string name)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(NormalizeName(name)));
        return Convert.ToHexString(bytes, 0, 6).ToLowerInvariant();
    }

    /// <summary>Kodu verilen adlar arasindan cozer. Cozulemezse (eski sira kodlari, silinmis ad) null doner.</summary>
    public static string? Resolve(string? code, IEnumerable<string> names)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var trimmed = code.Trim();
        var knownNames = names.ToList();
        var match = knownNames.FirstOrDefault(name => string.Equals(Encode(name), trimmed, StringComparison.Ordinal));
        if (match is not null)
        {
            return match;
        }

        // Eski surumde verilen sira numarasi ("3") ya da cozulemeyen bir kod: ad olarak saklanmaz.
        if (IsNumericOnly(trimmed) || EncodedCodePattern().IsMatch(trimmed))
        {
            return null;
        }

        // Kod olarak serbest metin gelmisse (test verisi vb.) ad olarak kabul edilir.
        return trimmed;
    }

    public static bool IsNumericOnly(string value)
        => value.Length > 0 && value.All(char.IsDigit);

    private static string NormalizeName(string name)
        => string.Join(' ', name.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            .ToUpper(new CultureInfo("tr-TR"));

    [GeneratedRegex("^[0-9a-f]{12}$")]
    private static partial Regex EncodedCodePattern();
}
