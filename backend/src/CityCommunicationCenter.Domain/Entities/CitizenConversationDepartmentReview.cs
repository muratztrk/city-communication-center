using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class CitizenConversationDepartmentReview : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid ReviewId { get; set; }

    public Guid CitizenConversationId { get; set; }

    public Guid DepartmentId { get; set; }

    public Guid JobId { get; set; }

    public Guid SocialMessageId { get; set; }

    public Guid RequestedByUserId { get; set; }

    public DateTimeOffset RequestedAtUtc { get; set; }

    public DateTimeOffset? AcknowledgedAtUtc { get; set; }

    public CitizenConversation CitizenConversation { get; set; } = null!;

    public Department Department { get; set; } = null!;

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(DepartmentId), nameof(AcknowledgedAtUtc)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(CitizenConversationId), nameof(DepartmentId)),
    ];
}
