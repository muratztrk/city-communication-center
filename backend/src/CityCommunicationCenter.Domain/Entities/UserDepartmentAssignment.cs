namespace CityCommunicationCenter.Domain.Entities;

public sealed class UserDepartmentAssignment : AuditableTenantEntity
{
    public Guid AssignmentId { get; set; }

    public Guid UserId { get; set; }

    public Guid DepartmentId { get; set; }

    public bool IsPrimary { get; set; }

    public ApplicationUser User { get; set; } = null!;

    public Department Department { get; set; } = null!;
}
