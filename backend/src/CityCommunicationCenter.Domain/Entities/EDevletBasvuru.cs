using System.Text.Json;
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

    /// <summary>Vatandasin e-Devlet uzerinden ekledigi notlar ve tekrar acma gerekceleri (JSON).</summary>
    public string? CitizenNotesJson { get; set; }

    public DateTimeOffset? ReopenedAtUtc { get; set; }

    public ICollection<EDevletBasvuruAttachment> Attachments { get; set; } = new List<EDevletBasvuruAttachment>();

    public const int MaxCitizenNotes = 50;

    private static readonly JsonSerializerOptions NoteJsonOptions = new(JsonSerializerDefaults.Web);

    public IReadOnlyList<EDevletBasvuruNote> GetCitizenNotes()
    {
        if (string.IsNullOrWhiteSpace(CitizenNotesJson))
        {
            return Array.Empty<EDevletBasvuruNote>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<EDevletBasvuruNote>>(CitizenNotesJson, NoteJsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return Array.Empty<EDevletBasvuruNote>();
        }
    }

    /// <returns>false when the note limit is reached.</returns>
    public bool AddCitizenNote(string kind, string text, DateTimeOffset at)
    {
        var notes = GetCitizenNotes().ToList();
        if (notes.Count >= MaxCitizenNotes)
        {
            return false;
        }

        notes.Add(new EDevletBasvuruNote(at, kind, text));
        CitizenNotesJson = JsonSerializer.Serialize(notes, NoteJsonOptions);
        return true;
    }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(
            [nameof(TenantId), nameof(TakipNo)],
            databaseName: "ix_edevletbasvurular_tenantid_takipno_unique"),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(CitizenTcKimlikNo), nameof(Status)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Status), nameof(CreatedAtUtc)),
    ];
}
