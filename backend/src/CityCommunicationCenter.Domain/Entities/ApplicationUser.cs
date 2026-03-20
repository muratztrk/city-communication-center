namespace CityCommunicationCenter.Domain.Entities;

public sealed class ApplicationUser : AuditableTenantEntity
{
    public Guid UserId { get; set; }

    public Guid DepartmentId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string? PasswordHash { get; set; }

    public string? ExternalIdentityId { get; set; }

    public Guid? ManagerUserId { get; set; }

    public RoleCode RoleCode { get; set; } = RoleCode.Staff;

    public bool IsActive { get; set; } = true;

    public Tenant Tenant { get; set; } = null!;

    public Department Department { get; set; } = null!;
}
