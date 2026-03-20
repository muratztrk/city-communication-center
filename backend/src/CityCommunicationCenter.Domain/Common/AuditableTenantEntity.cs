namespace CityCommunicationCenter.Domain.Common;

public abstract class AuditableTenantEntity
{
    public Guid TenantId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public Guid? CreatedByUserId { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public Guid? UpdatedByUserId { get; set; }
}
