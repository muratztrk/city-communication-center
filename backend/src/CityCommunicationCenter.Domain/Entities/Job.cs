using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class Job : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid JobId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public Guid OwnerDepartmentId { get; set; }

    public JobStatus Status { get; set; } = JobStatus.Draft;

    public string Priority { get; set; } = "Normal";

    public DateTimeOffset? StartDateUtc { get; set; }

    public DateTimeOffset? DueDateUtc { get; set; }

    public DateTimeOffset? CompletedAtUtc { get; set; }

    public JobSourceType SourceType { get; set; } = JobSourceType.Manual;

    public Guid? SourceRefId { get; set; }

    public string? CancelReason { get; set; }

    /// <summary>Cached completion percentage (0-100), computed from sub-tasks.</summary>
    public int? CompletionPercentage { get; set; }

    /// <summary>True if this job spans multiple departments (has Target or Support departments).</summary>
    public bool IsCoordinated { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public Department OwnerDepartment { get; set; } = null!;

    public ICollection<JobDepartment> Departments { get; set; } = new List<JobDepartment>();

    public ICollection<WorkTask> Tasks { get; set; } = new List<WorkTask>();

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Status)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(OwnerDepartmentId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(DueDateUtc)),
    ];
}
