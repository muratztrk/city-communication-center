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
    public DbSet<Job> Jobs => Set<Job>();
    public DbSet<JobDepartment> JobDepartments => Set<JobDepartment>();
    public DbSet<WorkTask> Tasks => Set<WorkTask>();
    public DbSet<WorkflowApproval> Approvals => Set<WorkflowApproval>();
    public DbSet<AssignmentHistory> AssignmentHistories => Set<AssignmentHistory>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RoutingRule> RoutingRules => Set<RoutingRule>();
    public DbSet<PushSubscription> PushSubscriptions => Set<PushSubscription>();

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
        ConfigureJob(modelBuilder.Entity<Job>());
        ConfigureJobDepartment(modelBuilder.Entity<JobDepartment>());
        ConfigureTask(modelBuilder.Entity<WorkTask>());
        ConfigureWorkflowApproval(modelBuilder.Entity<WorkflowApproval>());
        ConfigureAssignmentHistory(modelBuilder.Entity<AssignmentHistory>());
        ConfigureNotification(modelBuilder.Entity<Notification>());
        ConfigureAuditLog(modelBuilder.Entity<AuditLog>());
        ConfigureRoutingRule(modelBuilder.Entity<RoutingRule>());
        ConfigurePushSubscription(modelBuilder.Entity<PushSubscription>());

        modelBuilder.ApplyAutomaticIndexes();

        ApplyTenantFilter(modelBuilder.Entity<TenantSetting>());
        ApplyTenantFilter(modelBuilder.Entity<Department>());
        ApplyTenantFilter(modelBuilder.Entity<ApplicationUser>());
        ApplyTenantFilter(modelBuilder.Entity<SocialMessage>());
        ApplyTenantFilter(modelBuilder.Entity<Job>());
        ApplyTenantFilter(modelBuilder.Entity<JobDepartment>());
        ApplyTenantFilter(modelBuilder.Entity<WorkTask>());
        ApplyTenantFilter(modelBuilder.Entity<WorkflowApproval>());
        ApplyTenantFilter(modelBuilder.Entity<AssignmentHistory>());
        ApplyTenantFilter(modelBuilder.Entity<Notification>());
        ApplyTenantFilter(modelBuilder.Entity<AuditLog>());
        ApplyTenantFilter(modelBuilder.Entity<RoutingRule>());
        ApplyTenantFilter(modelBuilder.Entity<PushSubscription>());

        ApplyInstallSeedData(modelBuilder);
    }

    private static void ApplyInstallSeedData(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Tenant>().HasData(
            new Tenant
            {
                TenantId = InitialData.TenantId,
                MunicipalityName = "Tire Belediyesi",
                DisplayName = "Tire Belediyesi",
                DeploymentMode = DeploymentMode.DedicatedHosted,
                IsActive = true,
                CreatedAtUtc = InitialData.CreatedAtUtc,
            });

        modelBuilder.Entity<Department>().HasData(
            new Department
            {
                DepartmentId = InitialData.AdminDepartmentId,
                TenantId = InitialData.TenantId,
                Name = "Sistem Yönetimi",
                DepartmentType = "Administration",
                ManagerUserId = InitialData.AdminUserId,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            },
            new Department
            {
                DepartmentId = InitialData.PublicWorksDepartmentId,
                TenantId = InitialData.TenantId,
                Name = "Fen İşleri Müdürlüğü",
                DepartmentType = "Müdürlük",
                ManagerUserId = InitialData.PublicWorksManagerUserId,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            },
            new Department
            {
                DepartmentId = InitialData.CommunicationsDepartmentId,
                TenantId = InitialData.TenantId,
                Name = "Basın Yayın Müdürlüğü",
                DepartmentType = "Müdürlük",
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            });

        modelBuilder.Entity<ApplicationUser>().HasData(
            new ApplicationUser
            {
                UserId = InitialData.AdminUserId,
                TenantId = InitialData.TenantId,
                DepartmentId = InitialData.AdminDepartmentId,
                Username = InitialData.AdminUsername,
                DisplayName = "Sistem Yöneticisi",
                Email = "admin@tire.bel.tr",
                PasswordHash = null,
                RoleCode = RoleCode.SystemAdmin,
                UserSource = UserSource.Manual,
                IsActive = true,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            },
            new ApplicationUser
            {
                UserId = InitialData.PublicWorksManagerUserId,
                TenantId = InitialData.TenantId,
                DepartmentId = InitialData.PublicWorksDepartmentId,
                Username = InitialData.PublicWorksManagerUsername,
                DisplayName = "Zeynep Kara",
                Email = "zeynep.kara@tire.bel.tr",
                PasswordHash = null,
                RoleCode = RoleCode.Manager,
                UserSource = UserSource.Manual,
                IsActive = true,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            },
            new ApplicationUser
            {
                UserId = InitialData.PublicWorksStaffUserId,
                TenantId = InitialData.TenantId,
                DepartmentId = InitialData.PublicWorksDepartmentId,
                Username = InitialData.PublicWorksStaffUsername,
                DisplayName = "Emre Çelik",
                Email = "emre.celik@tire.bel.tr",
                PasswordHash = null,
                ManagerUserId = InitialData.PublicWorksManagerUserId,
                RoleCode = RoleCode.Staff,
                UserSource = UserSource.Manual,
                IsActive = true,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            },
            new ApplicationUser
            {
                UserId = InitialData.CommunicationsStaffUserId,
                TenantId = InitialData.TenantId,
                DepartmentId = InitialData.CommunicationsDepartmentId,
                Username = InitialData.CommunicationsStaffUsername,
                DisplayName = "Ali Yıldız",
                Email = "ali.yildiz@tire.bel.tr",
                PasswordHash = null,
                RoleCode = RoleCode.Operator,
                UserSource = UserSource.Manual,
                IsActive = true,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            });

        modelBuilder.Entity<TenantSetting>().HasData(
            new TenantSetting
            {
                TenantSettingId = InitialData.TenantSettingId,
                TenantId = InitialData.TenantId,
                DisplayName = "Tire Belediyesi",
                DefaultSlaHours = 48,
                AutoRoutingEnabled = true,
                LdapSettingsJson = InitialData.SeedTenantLdapSettingsJson,
                AuthPolicyJson = InitialData.SeedTenantAuthenticationPolicyJson,
                AppearanceJson = InitialData.SeedTenantAppearanceJson,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            });

        modelBuilder.Entity<Job>().HasData(
            new Job
            {
                JobId = InitialData.SampleJobId,
                TenantId = InitialData.TenantId,
                Title = "Örnek altyapı inceleme işi",
                Description = "İlk kurulum sonrası arayüz kontrolü için eklenen örnek iş.",
                OwnerDepartmentId = InitialData.PublicWorksDepartmentId,
                Status = JobStatus.Active,
                Priority = "Normal",
                DueDateUtc = InitialData.SampleTaskDueDateUtc,
                SourceType = JobSourceType.Manual,
                IsCoordinated = false,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            });

        modelBuilder.Entity<JobDepartment>().HasData(
            new JobDepartment
            {
                JobDepartmentId = InitialData.SampleJobOwnerDepartmentId,
                TenantId = InitialData.TenantId,
                JobId = InitialData.SampleJobId,
                DepartmentId = InitialData.PublicWorksDepartmentId,
                Role = JobDepartmentRole.Owner,
                ApprovalStatus = JobApprovalStatus.Approved,
                RequestedByUserId = InitialData.AdminUserId,
                RequestedAtUtc = InitialData.CreatedAtUtc,
                ApprovedByUserId = InitialData.PublicWorksManagerUserId,
                DecidedAtUtc = InitialData.CreatedAtUtc,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            });

        modelBuilder.Entity<WorkTask>().HasData(
            new WorkTask
            {
                TaskId = InitialData.SampleTaskId,
                TenantId = InitialData.TenantId,
                JobId = InitialData.SampleJobId,
                Title = "Örnek altyapı inceleme görevi",
                Description = "İlk kurulum sonrası arayüz kontrolü için eklenen örnek görev.",
                AssignedDepartmentId = InitialData.PublicWorksDepartmentId,
                AssignedUserId = InitialData.PublicWorksStaffUserId,
                AssigningManagerId = InitialData.PublicWorksManagerUserId,
                CurrentStatus = WorkflowTaskStatus.Assigned,
                Priority = "Normal",
                DueDateUtc = InitialData.SampleTaskDueDateUtc,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            });

        modelBuilder.Entity<SocialMessage>().HasData(
            new SocialMessage
            {
                SocialMessageId = InitialData.SampleSocialMessageId,
                TenantId = InitialData.TenantId,
                Channel = SocialChannel.Instagram,
                ExternalMessageId = "demo-instagram-message-1",
                CitizenHandle = "tire.vatandas",
                Content = "Yolda çukur var, ekip yönlendirebilir misiniz?",
                Category = "Altyapı",
                Tags = string.Empty,
                Status = SocialMessageStatus.Routed,
                AssignedDepartmentId = InitialData.PublicWorksDepartmentId,
                ReceivedAtUtc = InitialData.SampleMessageReceivedAtUtc,
                CreatedAtUtc = InitialData.CreatedAtUtc,
                CreatedByUserId = InitialData.AdminUserId,
            });

        modelBuilder.Entity<RoutingRule>().HasData(
            new RoutingRule
            {
                RuleId = InitialData.SampleRoutingRuleId,
                TenantId = InitialData.TenantId,
                RuleName = "Altyapı Talepleri",
                Keywords = "altyapı,çukur,yol,asfalt",
                TargetDepartmentId = InitialData.PublicWorksDepartmentId,
                Priority = 90,
                IsActive = true,
                CreatedAtUtc = InitialData.CreatedAtUtc,
            });
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
        builder.Property(entity => entity.SocialSettingsJson).HasColumnType("text");
        builder.Property(entity => entity.LdapSettingsJson).HasColumnType("text");
        builder.Property(entity => entity.AuthPolicyJson).HasColumnType("text");
        builder.Property(entity => entity.AppearanceJson).HasColumnType("text");
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
        builder.Property(entity => entity.UserSource).HasConversion<string>();
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
        builder.HasOne(entity => entity.Job)
            .WithMany()
            .HasForeignKey(entity => entity.JobId)
            .OnDelete(DeleteBehavior.SetNull);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureJob(EntityTypeBuilder<Job> builder)
    {
        builder.ToTable("jobs");
        builder.HasKey(entity => entity.JobId);
        builder.Property(entity => entity.Status).HasConversion<string>();
        builder.Property(entity => entity.SourceType).HasConversion<string>();
        builder.HasOne(entity => entity.Tenant)
            .WithMany()
            .HasForeignKey(entity => entity.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(entity => entity.OwnerDepartment)
            .WithMany()
            .HasForeignKey(entity => entity.OwnerDepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(entity => entity.Departments)
            .WithOne(entity => entity.Job)
            .HasForeignKey(entity => entity.JobId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(entity => entity.Tasks)
            .WithOne(entity => entity.Job)
            .HasForeignKey(entity => entity.JobId)
            .OnDelete(DeleteBehavior.Cascade);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureJobDepartment(EntityTypeBuilder<JobDepartment> builder)
    {
        builder.ToTable("jobdepartments");
        builder.HasKey(entity => entity.JobDepartmentId);
        builder.Property(entity => entity.Role).HasConversion<string>();
        builder.Property(entity => entity.ApprovalStatus).HasConversion<string>();
        builder.HasOne(entity => entity.Department)
            .WithMany()
            .HasForeignKey(entity => entity.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureTask(EntityTypeBuilder<WorkTask> builder)
    {
        builder.ToTable("tasks");
        builder.HasKey(entity => entity.TaskId);
        builder.Property(entity => entity.CurrentStatus).HasConversion<string>();
        builder.Property(entity => entity.EstimatedHours).HasColumnType("numeric(9,2)");
        builder.Property(entity => entity.ActualHours).HasColumnType("numeric(9,2)");
        builder.HasOne(entity => entity.Tenant)
            .WithMany(tenant => tenant.Tasks)
            .HasForeignKey(entity => entity.TenantId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(entity => entity.AssignmentHistory)
            .WithOne(entity => entity.Task)
            .HasForeignKey(entity => entity.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        ApplyLowerCaseColumnNames(builder);
    }

    private static void ConfigureWorkflowApproval(EntityTypeBuilder<WorkflowApproval> builder)
    {
        builder.ToTable("approvals");
        builder.HasKey(entity => entity.ApprovalId);
        builder.Property(entity => entity.SubjectType).HasConversion<string>();
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

    private static void ConfigurePushSubscription(EntityTypeBuilder<PushSubscription> builder)
    {
        builder.ToTable("pushsubscriptions");
        builder.HasKey(entity => entity.PushSubscriptionId);
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
