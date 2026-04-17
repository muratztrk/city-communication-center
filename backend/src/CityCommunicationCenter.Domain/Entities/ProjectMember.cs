using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class ProjectMember : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid ProjectMemberId { get; set; }

    public Guid ProjectId { get; set; }

    public Guid UserId { get; set; }

    public Guid DepartmentId { get; set; }

    public Project Project { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(ProjectId), nameof(UserId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(UserId)),
    ];
}
