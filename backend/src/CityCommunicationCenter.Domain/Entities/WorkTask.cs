using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class WorkTask : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid TaskId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public TaskType TaskType { get; set; } = TaskType.InternalRequest;

    public SourceType SourceType { get; set; } = SourceType.Manual;

    public Guid? SourceRefId { get; set; }

    public Guid? TargetDepartmentId { get; set; }

    public Guid? AssignedDepartmentId { get; set; }

    public Guid? AssignedUserId { get; set; }

    public CityCommunicationCenter.Domain.Enums.TaskStatus CurrentStatus { get; set; } =
        CityCommunicationCenter.Domain.Enums.TaskStatus.Draft;

    public string Priority { get; set; } = "Normal";

    public DateTimeOffset? DueDateUtc { get; set; }

    public DateTimeOffset? CompletedAtUtc { get; set; }

    public DateTimeOffset? ClosedAtUtc { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public ICollection<Approval> Approvals { get; set; } = new List<Approval>();

    public ICollection<AssignmentHistory> AssignmentHistory { get; set; } = new List<AssignmentHistory>();

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(CurrentStatus)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(AssignedDepartmentId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(AssignedUserId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(DueDateUtc)),
    ];
}
