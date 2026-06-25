namespace CityCommunicationCenter.Domain.Entities;

public sealed class EDevletDailyActivityPlan : AuditableTenantEntity
{
    public Guid PlanId { get; set; }

    public Guid ActivityTypeId { get; set; }

    public string Description { get; set; } = string.Empty;

    public string? Neighborhood { get; set; }

    public string? Street { get; set; }

    public string? OpenAddress { get; set; }

    public EDevletActivityType ActivityType { get; set; } = null!;
}
