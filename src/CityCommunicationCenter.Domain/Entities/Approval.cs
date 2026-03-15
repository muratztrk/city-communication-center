using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class Approval : AuditableTenantEntity
{
    public Guid ApprovalId { get; set; }

    public Guid TaskId { get; set; }

    public Guid ApproverUserId { get; set; }

    public int StepOrder { get; set; }

    public ApprovalDecision Decision { get; set; } = ApprovalDecision.Pending;

    public string? Comment { get; set; }

    public DateTimeOffset? DecisionDateUtc { get; set; }

    public WorkTask Task { get; set; } = null!;
}
