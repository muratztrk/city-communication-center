namespace CityCommunicationCenter.Infrastructure.Options;

public sealed class LicensingOptions
{
    public const string SectionName = "Licensing";

    public string BaseUrl { get; set; } = "https://lisans.lumespec.com";

    /// <summary>Bundle id önekı: "{BundleIdPrefix}.{tenantId:N}.{citizen|internal}".</summary>
    public string BundleIdPrefix { get; set; } = "com.lumespec.ccc";

    public int TimeoutSeconds { get; set; } = 5;

    /// <summary>Anahtar rotasyonu için birden fazla public key tutulabilir (JWT header'daki "kid" ile eşleşir).</summary>
    public List<LicensingPublicKeyOptions> PublicKeys { get; set; } = [];

    /// <summary>Aynı (tenant, modül) çifti için ardışık sorguları sınırlayan bellek-içi önbellek süresi.</summary>
    public int CacheMinutes { get; set; } = 15;
}

public sealed class LicensingPublicKeyOptions
{
    public string Kid { get; set; } = string.Empty;

    /// <summary>Ham Ed25519 public key, hex ("pnpm keys:generate" çıktısı — lumespec-license reposu).</summary>
    public string PublicKeyHex { get; set; } = string.Empty;
}
