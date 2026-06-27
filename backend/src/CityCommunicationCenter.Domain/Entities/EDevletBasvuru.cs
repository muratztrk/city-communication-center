using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class EDevletBasvuru : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid BasvuruId { get; set; }

    public string TakipNo { get; set; } = string.Empty;

    public int BasvuruNumber { get; set; }

    public int BasvuruNumberYear { get; set; }

    public string CitizenTcKimlikNo { get; set; } = string.Empty;

    public string CitizenFirstName { get; set; } = string.Empty;

    public string CitizenLastName { get; set; } = string.Empty;

    public string BasvuruTipi { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string? PhoneNumbersJson { get; set; }

    public string? IlceKodu { get; set; }

    public string? IlceAdi { get; set; }

    public string? MahalleKodu { get; set; }

    public string? MahalleAdi { get; set; }

    public string? SokakCaddeKodu { get; set; }

    public string? SokakCaddeAdi { get; set; }

    public string? DisKapiNo { get; set; }

    public string? IcKapiNo { get; set; }

    public string? OpenAddress { get; set; }

    public string? NviAdresNo { get; set; }

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public string? CevapSekli { get; set; }

    public EDevletBasvuruStatus Status { get; set; } = EDevletBasvuruStatus.PendingReview;

    public Guid? JobId { get; set; }

    public Job? Job { get; set; }

    public ICollection<EDevletBasvuruAttachment> Attachments { get; set; } = new List<EDevletBasvuruAttachment>();

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(nameof(TenantId), nameof(TakipNo)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(CitizenTcKimlikNo), nameof(Status)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Status), nameof(CreatedAtUtc)),
    ];
}
