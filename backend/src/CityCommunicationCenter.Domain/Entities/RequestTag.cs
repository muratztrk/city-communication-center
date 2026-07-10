namespace CityCommunicationCenter.Domain.Entities;

public sealed class RequestTag : AuditableTenantEntity
{
    public Guid TagId { get; set; }

    public string Name { get; set; } = string.Empty;
}
