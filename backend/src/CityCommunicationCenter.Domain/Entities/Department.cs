using CityCommunicationCenter.Domain.Common;

namespace CityCommunicationCenter.Domain.Entities;

public sealed class Department : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid DepartmentId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string DepartmentType { get; set; } = string.Empty;

    public Guid? ParentDepartmentId { get; set; }

    public Guid? ManagerUserId { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public Department? ParentDepartment { get; set; }

    public ICollection<Department> ChildDepartments { get; set; } = new List<Department>();

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Name)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(ManagerUserId)),
    ];
}
