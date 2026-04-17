using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class ProjectDepartment : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid ProjectDepartmentId { get; set; }

    public Guid ProjectId { get; set; }

    public Guid DepartmentId { get; set; }

    public ProjectDepartmentApprovalStatus ApprovalStatus { get; set; } = ProjectDepartmentApprovalStatus.Pending;

    public Guid? ApprovedByUserId { get; set; }

    public DateTimeOffset? ApprovalDateUtc { get; set; }

    public Project Project { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(ProjectId), nameof(DepartmentId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(DepartmentId), nameof(ApprovalStatus)),
    ];
}
