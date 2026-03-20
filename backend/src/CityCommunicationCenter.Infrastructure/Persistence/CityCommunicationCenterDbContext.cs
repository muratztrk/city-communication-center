using CityCommunicationCenter.Domain.Common;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Infrastructure.Persistence;

public sealed class CityCommunicationCenterDbContext : DbContext, IApplicationDbContext
{
    private readonly ITenantContextAccessor? _tenantContextAccessor;

    public CityCommunicationCenterDbContext(DbContextOptions<CityCommunicationCenterDbContext> options)
        : base(options)
    {
    }

    public CityCommunicationCenterDbContext(
        DbContextOptions<CityCommunicationCenterDbContext> options,
        ITenantContextAccessor tenantContextAccessor)
        : base(options)
    {
        _tenantContextAccessor = tenantContextAccessor;
    }

    private Guid? CurrentTenantId => _tenantContextAccessor?.GetCurrent().TenantId;

    private bool IsTenantFilterEnabled => _tenantContextAccessor?.GetCurrent().ApplyQueryFilter ?? false;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<TenantSetting> TenantSettings => Set<TenantSetting>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<ApplicationUser> Users => Set<ApplicationUser>();
    public DbSet<SocialMessage> SocialMessages => Set<SocialMessage>();
    public DbSet<WorkTask> Tasks => Set<WorkTask>();
    public DbSet<Approval> Approvals => Set<Approval>();
    public DbSet<AssignmentHistory> AssignmentHistories => Set<AssignmentHistory>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RoutingRule> RoutingRules => Set<RoutingRule>();

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var utcNow = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableTenantEntity>())
        {
            if (entry.State == EntityState.Added && entry.Entity.CreatedAtUtc == default)
            {
                entry.Entity.CreatedAtUtc = utcNow;
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = utcNow;
            }
        }

        foreach (var entry in ChangeTracker.Entries<Tenant>())
        {
            if (entry.State == EntityState.Added && entry.Entity.CreatedAtUtc == default)
            {
                entry.Entity.CreatedAtUtc = utcNow;
            }
        }

        foreach (var entry in ChangeTracker.Entries<RoutingRule>())
        {
            if (entry.State == EntityState.Added && entry.Entity.CreatedAtUtc == default)
            {
                entry.Entity.CreatedAtUtc = utcNow;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureTenant(modelBuilder.Entity<Tenant>());
        ConfigureTenantSetting(modelBuilder.Entity<TenantSetting>());
        ConfigureDepartment(modelBuilder.Entity<Department>());
        ConfigureApplicationUser(modelBuilder.Entity<ApplicationUser>());
        ConfigureSocialMessage(modelBuilder.Entity<SocialMessage>());
        ConfigureTask(modelBuilder.Entity<WorkTask>());
        ConfigureApproval(modelBuilder.Entity<Approval>());
        ConfigureAssignmentHistory(modelBuilder.Entity<AssignmentHistory>());
        ConfigureNotification(modelBuilder.Entity<Notification>());
        ConfigureAuditLog(modelBuilder.Entity<AuditLog>());
        ConfigureRoutingRule(modelBuilder.Entity<RoutingRule>());

        ApplyTenantFilter(modelBuilder.Entity<TenantSetting>());
        ApplyTenantFilter(modelBuilder.Entity<Department>());
        ApplyTenantFilter(modelBuilder.Entity<ApplicationUser>());
        ApplyTenantFilter(modelBuilder.Entity<SocialMessage>());
        ApplyTenantFilter(modelBuilder.Entity<WorkTask>());
        ApplyTenantFilter(modelBuilder.Entity<Approval>());
        ApplyTenantFilter(modelBuilder.Entity<AssignmentHistory>());
        ApplyTenantFilter(modelBuilder.Entity<Notification>());
        ApplyTenantFilter(modelBuilder.Entity<AuditLog>());
        ApplyTenantFilter(modelBuilder.Entity<RoutingRule>());
    }

    private void ApplyTenantFilter<TEntity>(EntityTypeBuilder<TEntity> builder)
        where TEntity : AuditableTenantEntity
    {
        builder.HasQueryFilter(entity => !IsTenantFilterEnabled || entity.TenantId == CurrentTenantId);
    }

    private void ApplyTenantFilter(EntityTypeBuilder<RoutingRule> builder)
    {
        builder.HasQueryFilter(entity => !IsTenantFilterEnabled || entity.TenantId == CurrentTenantId);
    }

    private static void ConfigureTenant(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");
        builder.HasKey(entity => entity.TenantId);
        builder.Property(entity => entity.DeploymentMode).HasConversion<string>();
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureTenantSetting(EntityTypeBuilder<TenantSetting> builder)
    {
        builder.ToTable("tenantsettings");
        builder.HasKey(entity => entity.TenantSettingId);
        builder.HasIndex(entity => entity.TenantId).IsUnique();
        builder.Property(entity => entity.SocialSettingsJson).HasColumnType("text");
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureDepartment(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("departments");
        builder.HasKey(entity => entity.DepartmentId);
        builder.HasOne(entity => entity.Tenant)
            .WithMany(tenant => tenant.Departments)
            .HasForeignKey(entity => entity.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(entity => entity.ParentDepartment)
            .WithMany(entity => entity.ChildDepartments)
            .HasForeignKey(entity => entity.ParentDepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureApplicationUser(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.ToTable("users");
        builder.HasKey(entity => entity.UserId);
        builder.Property(entity => entity.RoleCode).HasConversion<string>();
        builder.HasOne(entity => entity.Tenant)
            .WithMany(tenant => tenant.Users)
            .HasForeignKey(entity => entity.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(entity => entity.Department)
            .WithMany()
            .HasForeignKey(entity => entity.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureSocialMessage(EntityTypeBuilder<SocialMessage> builder)
    {
        builder.ToTable("socialmessages");
        builder.HasKey(entity => entity.SocialMessageId);
        builder.Property(entity => entity.Channel).HasConversion<string>();
        builder.Property(entity => entity.Status).HasConversion<string>();
        builder.HasOne(entity => entity.Tenant)
            .WithMany(tenant => tenant.SocialMessages)
            .HasForeignKey(entity => entity.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(entity => entity.AssignedDepartment)
            .WithMany()
            .HasForeignKey(entity => entity.AssignedDepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(entity => entity.Task)
            .WithMany()
            .HasForeignKey(entity => entity.TaskId)
            .OnDelete(DeleteBehavior.SetNull);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureTask(EntityTypeBuilder<WorkTask> builder)
    {
        builder.ToTable("tasks");
        builder.HasKey(entity => entity.TaskId);
        builder.Property(entity => entity.TaskType).HasConversion<string>();
        builder.Property(entity => entity.SourceType).HasConversion<string>();
        builder.Property(entity => entity.CurrentStatus).HasConversion<string>();
        builder.HasOne(entity => entity.Tenant)
            .WithMany(tenant => tenant.Tasks)
            .HasForeignKey(entity => entity.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(entity => entity.Approvals)
            .WithOne(entity => entity.Task)
            .HasForeignKey(entity => entity.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(entity => entity.AssignmentHistory)
            .WithOne(entity => entity.Task)
            .HasForeignKey(entity => entity.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureApproval(EntityTypeBuilder<Approval> builder)
    {
        builder.ToTable("approvals");
        builder.HasKey(entity => entity.ApprovalId);
        builder.Property(entity => entity.Decision).HasConversion<string>();
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureAssignmentHistory(EntityTypeBuilder<AssignmentHistory> builder)
    {
        builder.ToTable("assignmenthistory");
        builder.HasKey(entity => entity.AssignmentId);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureNotification(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");
        builder.HasKey(entity => entity.NotificationId);
        builder.Property(entity => entity.Channel).HasConversion<string>();
        builder.Property(entity => entity.DeliveryStatus).HasConversion<string>();
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureAuditLog(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("auditlogs");
        builder.HasKey(entity => entity.AuditLogId);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureRoutingRule(EntityTypeBuilder<RoutingRule> builder)
    {
        builder.ToTable("routingrules");
        builder.HasKey(entity => entity.RuleId);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ApplyLowerCaseColumnNames<TEntity>(EntityTypeBuilder<TEntity> builder)
        where TEntity : class
    {
        foreach (var property in builder.Metadata.GetProperties())
        {
            property.SetColumnName(property.Name.ToLowerInvariant());
        }
    }
}
