namespace CityCommunicationCenter.Domain.Entities;

public sealed class WorkflowApproval : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid ApprovalId { get; set; }

    public ApprovalSubjectType SubjectType { get; set; }

    public Guid SubjectId { get; set; }

    public int StepOrder { get; set; }

    public Guid ApproverUserId { get; set; }

    public ApprovalDecision Decision { get; set; } = ApprovalDecision.Pending;

    public string? Comment { get; set; }

    public DateTimeOffset? DecisionDateUtc { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(SubjectType), nameof(SubjectId), nameof(StepOrder)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(ApproverUserId), nameof(Decision)),
    ];
}
