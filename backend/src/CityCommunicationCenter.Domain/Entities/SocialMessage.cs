using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class SocialMessage : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid SocialMessageId { get; set; }

    public SocialChannel Channel { get; set; } = SocialChannel.Other;

    public string ExternalMessageId { get; set; } = string.Empty;

    public string CitizenHandle { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public string? Category { get; set; }

    public string Tags { get; set; } = string.Empty;

    public SocialMessageStatus Status { get; set; } = SocialMessageStatus.New;

    public Guid? AssignedDepartmentId { get; set; }

    public Guid? TaskId { get; set; }

    public DateTimeOffset ReceivedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>Response content sent back to the citizen</summary>
    public string? ResponseContent { get; set; }

    /// <summary>When the response was sent</summary>
    public DateTimeOffset? RespondedAtUtc { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public Department? AssignedDepartment { get; set; }

    public WorkTask? Task { get; set; }

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique([nameof(TenantId), nameof(Channel), nameof(ExternalMessageId)], databaseName: "ix_socialmessages_tenant_channel_external_unique"),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Status), nameof(ReceivedAtUtc)),
    ];
}
