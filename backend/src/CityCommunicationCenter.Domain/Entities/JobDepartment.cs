using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class JobDepartment : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid JobDepartmentId { get; set; }

    public Guid JobId { get; set; }

    public Guid DepartmentId { get; set; }

    public JobDepartmentRole Role { get; set; } = JobDepartmentRole.Target;

    public JobApprovalStatus ApprovalStatus { get; set; } = JobApprovalStatus.Pending;

    public Guid? RequestedByUserId { get; set; }

    public DateTimeOffset? RequestedAtUtc { get; set; }

    public Guid? ApprovedByUserId { get; set; }

    public DateTimeOffset? DecidedAtUtc { get; set; }

    public string? RejectReason { get; set; }

    public string? Notes { get; set; }

    public Job Job { get; set; } = null!;

    public Department Department { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(JobId)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(DepartmentId), nameof(ApprovalStatus)),
    ];
}
