using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class AuditLog : AuditableTenantEntity
{
    public Guid AuditLogId { get; set; }

    public string EntityType { get; set; } = string.Empty;

    public string EntityId { get; set; } = string.Empty;

    public string Action { get; set; } = string.Empty;

    public Guid? ActorUserId { get; set; }

    public DateTimeOffset EventTimeUtc { get; set; } = DateTimeOffset.UtcNow;

    public string? Details { get; set; }
}
