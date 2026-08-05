namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>
/// lumespec-license panelinde belediye adları "com.lumespec.{slug}" biçiminde kayıtlı
/// (ör. "Tire Belediyesi" → com.lumespec.tirebelediyesi). CCC aynı adlandırmayı
/// "com.lumespec.ccc.{slug}.{modül}" olarak kullanır.
/// </summary>
public static class TenantSlug
{
    public static string From(string municipalityName)
    {
        var normalized = municipalityName
            .Replace('İ', 'i').Replace('I', 'i').Replace('ı', 'i')
            .Replace('Ğ', 'g').Replace('ğ', 'g')
            .Replace('Ü', 'u').Replace('ü', 'u')
            .Replace('Ş', 's').Replace('ş', 's')
            .Replace('Ö', 'o').Replace('ö', 'o')
            .Replace('Ç', 'c').Replace('ç', 'c')
            .ToLowerInvariant();

        return new string(normalized.Where(char.IsLetterOrDigit).ToArray());
    }
}
