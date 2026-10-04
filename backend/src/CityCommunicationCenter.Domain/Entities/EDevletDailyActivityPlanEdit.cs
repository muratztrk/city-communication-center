namespace CityCommunicationCenter.Domain.Entities;

/// <summary>
/// e-Devlet günlük faaliyet planında yapılan bir düzenleme: kim, ne zaman, hangi alanları değiştirdi.
/// Yalnız değişiklik olan kaydetmelerde oluşur (#6ac21381).
/// </summary>
public sealed class EDevletDailyActivityPlanEdit : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid EditId { get; set; }

    public Guid PlanId { get; set; }

    public Guid? EditedByUserId { get; set; }

    /// <summary>Düzenleme anındaki kullanıcı adı (kullanıcı yeniden adlandırılsa da görünür kalır).</summary>
    public string? EditedByDisplayName { get; set; }

    public DateTimeOffset EditedAtUtc { get; set; }

    /// <summary>Değişen alan adları, ';' ile ayrılmış (ör. "Faaliyet Tipi;Durum").</summary>
    public string ChangedFields { get; set; } = string.Empty;

    /// <summary>Yapılan işlem: "Düzenleme", "Pasife Alma" veya "Aktife Alma".</summary>
    public string? Action { get; set; }

    /// <summary>Alan başına "Alan: eski → yeni" satırları, '\n' ile ayrılmış.</summary>
    public string? ChangeSummary { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(PlanId), nameof(EditedAtUtc)),
    ];
}
