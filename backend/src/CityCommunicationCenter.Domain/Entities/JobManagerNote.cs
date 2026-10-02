namespace CityCommunicationCenter.Domain.Entities;

/// <summary>
/// Talebe birim müdürü/sorumlusu tarafından eklenen "Yönetici Notu". Her yönetici talep başına
/// yalnız kendi notunu ekler/değiştirir/siler; farklı birimlerdeki yöneticiler de not ekleyebilir.
/// </summary>
public sealed class JobManagerNote : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid NoteId { get; set; }

    public Guid JobId { get; set; }

    public Guid AuthorUserId { get; set; }

    /// <summary>Not eklendiği andaki yazar adı (kullanıcı silinse/yeniden adlandırılsa da görünür kalır).</summary>
    public string? AuthorDisplayName { get; set; }

    public string Text { get; set; } = string.Empty;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique([nameof(JobId), nameof(AuthorUserId)]),
    ];
}
