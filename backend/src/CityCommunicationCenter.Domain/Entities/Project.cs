using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class Project : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid ProjectId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public ProjectType ProjectType { get; set; }

    public ProjectStatus Status { get; set; } = ProjectStatus.Planned;

    /// <summary>
    /// The primary department that owns/coordinates this project.
    /// For Directorate projects: the owning müdürlük.
    /// For Coordinated projects: the coordinating müdürlük.
    /// </summary>
    public Guid OwnerDepartmentId { get; set; }

    /// <summary>
    /// Whether this project requires director approval (staff-created directorate projects).
    /// </summary>
    public bool RequiresApproval { get; set; }

    /// <summary>
    /// True once the director approves a staff-created project.
    /// </summary>
    public bool IsApproved { get; set; }

    public Guid? ApprovedByUserId { get; set; }

    public DateTimeOffset? ApprovedAtUtc { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public ICollection<ProjectStage> Stages { get; set; } = new List<ProjectStage>();

    public ICollection<ProjectDepartment> Departments { get; set; } = new List<ProjectDepartment>();

    public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(ProjectType)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Status)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(OwnerDepartmentId)),
    ];
}
