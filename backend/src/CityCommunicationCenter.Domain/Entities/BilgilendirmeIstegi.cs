using System.Text.Json;

namespace CityCommunicationCenter.Domain.Entities;

/// <summary>
/// e-Devlet "Bilgilendirilme Istegi" hizmeti: vatandasin SMS/e-posta ile bilgilendirilmek icin biraktigi kayit.
/// TC basina tek kayit tutulur; iptal edilen kayit pasife alinir, yeniden istek ayni kaydi gunceller.
/// </summary>
public sealed class BilgilendirmeIstegi : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public Guid BilgilendirmeIstegiId { get; set; }

    public string CitizenTcKimlikNo { get; set; } = string.Empty;

    public string Adi { get; set; } = string.Empty;

    public string Soyadi { get; set; } = string.Empty;

    public string Eposta { get; set; } = string.Empty;

    public string CepUlkeKodu { get; set; } = string.Empty;

    public string CepTelefonNo { get; set; } = string.Empty;

    /// <summary>[{"kod": "...", "ad": "..."}] - bos liste tum mahalleler demektir.</summary>
    public string? MahalleListesiJson { get; set; }

    public string? SmsKategoriKodlariJson { get; set; }

    public string? EpostaKategoriKodlariJson { get; set; }

    /// <summary>Vatandas belediye sistemindeki iletisim bilgisinin bu bilgilerle guncellenmesini istedi mi (kayit amacli).</summary>
    public bool BelediyeIletisimBilgisiniGuncelle { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTimeOffset? CancelledAtUtc { get; set; }

    public IReadOnlyList<BilgilendirmeMahalle> GetMahalleler() => Read<BilgilendirmeMahalle>(MahalleListesiJson);

    public IReadOnlyList<string> GetSmsKategoriKodlari() => Read<string>(SmsKategoriKodlariJson);

    public IReadOnlyList<string> GetEpostaKategoriKodlari() => Read<string>(EpostaKategoriKodlariJson);

    public void SetMahalleler(IEnumerable<BilgilendirmeMahalle> value) => MahalleListesiJson = JsonSerializer.Serialize(value, JsonOptions);

    public void SetSmsKategoriKodlari(IEnumerable<string> value) => SmsKategoriKodlariJson = JsonSerializer.Serialize(value, JsonOptions);

    public void SetEpostaKategoriKodlari(IEnumerable<string> value) => EpostaKategoriKodlariJson = JsonSerializer.Serialize(value, JsonOptions);

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(
            [nameof(TenantId), nameof(CitizenTcKimlikNo)],
            databaseName: "ix_bilgilendirmeistekleri_tenantid_tckimlikno_unique"),
    ];

    private static IReadOnlyList<T> Read<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<T>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<T>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return Array.Empty<T>();
        }
    }
}

public sealed record BilgilendirmeMahalle(string Kod, string Ad);
