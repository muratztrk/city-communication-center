using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class AssignmentHistory : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid AssignmentId { get; set; }

    public Guid TaskId { get; set; }

    public Guid? FromDepartmentId { get; set; }

    public Guid? ToDepartmentId { get; set; }

    public Guid? FromUserId { get; set; }

    public Guid? ToUserId { get; set; }

    public string ActionType { get; set; } = string.Empty;

    public DateTimeOffset ActionDateUtc { get; set; } = DateTimeOffset.UtcNow;

    public WorkTask Task { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TaskId), nameof(ActionDateUtc)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(ToDepartmentId)),
    ];
}
