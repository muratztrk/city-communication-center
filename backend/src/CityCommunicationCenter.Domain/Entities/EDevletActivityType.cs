namespace CityCommunicationCenter.Domain.Entities;

public sealed class EDevletActivityType : AuditableTenantEntity
{
    public Guid ActivityTypeId { get; set; }

    public string Name { get; set; } = string.Empty;

    public int SortOrder { get; set; }
}
