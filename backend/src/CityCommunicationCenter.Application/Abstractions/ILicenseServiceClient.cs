namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>Uygulamanın lisanslı modülleri. Bir tenant her ikisine de sahip olabilir.</summary>
public enum LicenseModule
{
    /// <summary>Vatandaş İş Takip Sistemi.</summary>
    Citizen,

    /// <summary>Kurum İçi İş Takip Sistemi.</summary>
    Internal,
}

/// <param name="Usable">Sunucunun imzaladığı nihai karar (active/warning/grace ⇒ true). İstemci bunu sorgulamaz, uygular.</param>
public sealed record LicenseModuleStatus(
    LicenseModule Module,
    bool Usable,
    string Status,
    DateTimeOffset? ValidUntil,
    string? Message);

/// <summary>
/// Lumespec'in merkezi lisans servisine (lisans.lumespec.com) tenant+modül başına sorulan,
/// Ed25519 ile imzalanmış lisans durumu. Aynı altyapı tire-miras ve bergama-belediyesi mobil
/// uygulamalarını lisanslamak için de kullanılıyor — CCC tarafında her (tenant, modül) çifti
/// ayrı bir "bundleId" gibi modellenir, lisans servisinin şemasına dokunulmaz.
/// </summary>
public interface ILicenseServiceClient
{
    /// <summary>
    /// Ağ hatası, imza doğrulama hatası veya yapılandırılmamış anahtar durumunda <c>Usable=true</c>
    /// döner (fail-open) — belediye hizmetini lisans servisine erişilemediği için kesmemek için.
    /// Sunucunun imzaladığı gerçek bir "blocked" kararı ise olduğu gibi uygulanır.
    /// </summary>
    /// <param name="tenantSlug">Bkz. <see cref="TenantSlug.From"/> — lumespec-license panelindeki Application ID'nin tenant kısmı.</param>
    Task<LicenseModuleStatus> GetModuleStatusAsync(
        string tenantSlug,
        LicenseModule module,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// lumespec-license panelinde belediye adları "com.lumespec.{slug}" biçiminde kayıtlı
/// (ör. "Tire Belediyesi" → com.lumespec.tirebelediyesi). CCC aynı adlandırmayı
/// "com.lumespec.ccc.{slug}.{modül}" olarak kullanır ki operatör panelde elle tenant
/// oluştururken mobil uygulamalarla aynı ismi tanısın.
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
