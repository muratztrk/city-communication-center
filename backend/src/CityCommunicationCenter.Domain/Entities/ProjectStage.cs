using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class ProjectStage : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid StageId { get; set; }

    public Guid ProjectId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public ProjectStageStatus Status { get; set; } = ProjectStageStatus.Planned;

    /// <summary>
    /// For coordinated projects: the department responsible for this stage.
    /// For directorate projects: same as the owning department.
    /// </summary>
    public Guid? ResponsibleDepartmentId { get; set; }

    public Project Project { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(ProjectId), nameof(DisplayOrder)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(ResponsibleDepartmentId)),
    ];
}
