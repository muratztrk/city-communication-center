namespace CityCommunicationCenter.Domain.Entities;

public sealed class ApplicationUser : AuditableTenantEntity, IHasDatabaseIndexDefinitions
{
    public Guid UserId { get; set; }

    public Guid DepartmentId { get; set; }

    public string? Username { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string? Email { get; set; }

    public string? Title { get; set; }

    public string? Phone { get; set; }

    /// <summary>Cep telefonu — LDAP <c>mobile</c>; yerel kullanıcıda isteğe bağlı (card #2902).</summary>
    public string? MobilePhone { get; set; }

    public string? PasswordHash { get; set; }

    public string? ExternalIdentityId { get; set; }

    public Guid? ManagerUserId { get; set; }

    public RoleCode RoleCode { get; set; } = RoleCode.Staff;

    public string? AdditionalRoleCodesJson { get; set; }

    public UserSource UserSource { get; set; } = UserSource.Manual;

    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Tek aktif oturum kimliği — yeni login önceki oturumu geçersiz kılar (#6a6c805e).
    /// </summary>
    public Guid? ActiveSessionId { get; set; }

    public Tenant Tenant { get; set; } = null!;

    public Department Department { get; set; } = null!;

    public ICollection<UserDepartmentAssignment> DepartmentAssignments { get; set; } = new List<UserDepartmentAssignment>();

    public static IReadOnlyList<DatabaseIndexDefinition> GetDatabaseIndexDefinitions() =>
    [
        DatabaseIndexDefinition.Unique([nameof(TenantId), nameof(Username)], "username IS NOT NULL", "ix_users_tenantid_username_unique"),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(Email)),
        DatabaseIndexDefinition.NonUnique(nameof(TenantId), nameof(RoleCode)),
    ];
}
