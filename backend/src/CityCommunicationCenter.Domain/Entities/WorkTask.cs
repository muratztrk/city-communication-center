namespace CityCommunicationCenter.Domain.Entities;

public sealed class WorkTask : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid TaskId { get; set; }

    public Guid JobId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public Guid? OwnerUserId { get; set; }

    public Guid? AssignedDepartmentId { get; set; }

    public Guid? AssignedUserId { get; set; }

    public Guid? AssigningManagerId { get; set; }

    public CityCommunicationCenter.Domain.Enums.TaskStatus CurrentStatus { get; set; } =
        CityCommunicationCenter.Domain.Enums.TaskStatus.Waiting;

    public string Priority { get; set; } = "Normal";

    public DateTimeOffset? StartDateUtc { get; set; }

    public DateTimeOffset? DueDateUtc { get; set; }

    public DateTimeOffset? CompletedAtUtc { get; set; }

    public decimal? EstimatedHours { get; set; }

    public decimal? ActualHours { get; set; }

    public int? CompletionPercentage { get; set; }

    public string? Notes { get; set; }

    public string? RevisionReason { get; set; }

    public Job Job { get; set; } = null!;

    public Tenant Tenant { get; set; } = null!;

    public ICollection<AssignmentHistory> AssignmentHistory { get; set; } = new List<AssignmentHistory>();

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(CurrentStatus)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(JobId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(AssignedDepartmentId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(AssignedUserId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(DueDateUtc)),
    ];
}
