using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class EDevletDailyActivityPlan : AuditableTenantEntity
{
    public Guid PlanId { get; set; }

    public Guid DepartmentId { get; set; }

    public Guid ActivityTypeId { get; set; }

    public int? PlanNumber { get; set; }

    public int? PlanNumberYear { get; set; }

    public EDevletDailyActivityPlanStatus Status { get; set; } = EDevletDailyActivityPlanStatus.Active;

    public string Description { get; set; } = string.Empty;

    public string? Neighborhood { get; set; }

    public string? Street { get; set; }

    public string? OpenAddress { get; set; }

    public EDevletActivityType ActivityType { get; set; } = null!;
}
