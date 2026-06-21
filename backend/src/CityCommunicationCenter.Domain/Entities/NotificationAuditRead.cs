namespace CityCommunicationCenter.Domain.Entities;

// Denetim kaydından (AuditLog) türeyen "geçmiş" bildirimlerin TEKİL okunma işareti.
// "Hepsini okundu yap" hâlâ NotificationReadCursor imlecini ilerletir (toplu okuma);
// tek bir geçmiş bildirime tıklamak ise yalnızca o olayı okur (rozet tam 1 azalır) — imleç
// ilerletildiğinde daha eski olayların da okunmuş sayılması (rozetin 9'dan 4'e düşmesi) sorununu
// giderir (card 633).
public sealed class NotificationAuditRead : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid NotificationAuditReadId { get; set; }

    public Guid UserId { get; set; }

    public Guid AuditLogId { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique(
            [nameof(TenantId), nameof(UserId), nameof(AuditLogId)],
            databaseName: "ix_notificationauditreads_tenant_user_audit_unique"),
    ];
}
