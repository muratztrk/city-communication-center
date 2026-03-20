using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class Tenant
{
    public Guid TenantId { get; set; }

    public string MunicipalityName { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public DeploymentMode DeploymentMode { get; set; } = DeploymentMode.DedicatedHosted;

    public bool IsActive { get; set; } = true;

    public string? Theme { get; set; }

    public string? Domain { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Department> Departments { get; set; } = new List<Department>();

    public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();

    public ICollection<SocialMessage> SocialMessages { get; set; } = new List<SocialMessage>();

    public ICollection<WorkTask> Tasks { get; set; } = new List<WorkTask>();
}
