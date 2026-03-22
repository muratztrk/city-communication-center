using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class Approval : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid ApprovalId { get; set; }

    public Guid TaskId { get; set; }

    public Guid ApproverUserId { get; set; }

    public int StepOrder { get; set; }

    public ApprovalDecision Decision { get; set; } = ApprovalDecision.Pending;

    public string? Comment { get; set; }

    public DateTimeOffset? DecisionDateUtc { get; set; }

    public WorkTask Task { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TaskId), nameof(StepOrder)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(ApproverUserId)),
    ];
}
