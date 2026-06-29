namespace CityCommunicationCenter.Domain.Entities;

public sealed class UserQuickReplyTemplate : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid TemplateId { get; set; }

    public Guid UserId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(UserId)),
    ];
}
