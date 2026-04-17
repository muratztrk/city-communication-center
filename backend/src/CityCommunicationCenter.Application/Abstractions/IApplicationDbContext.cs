using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Abstractions;

public interface IApplicationDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<TenantSetting> TenantSettings { get; }
    DbSet<Department> Departments { get; }
    DbSet<ApplicationUser> Users { get; }
    DbSet<SocialMessage> SocialMessages { get; }
    DbSet<WorkTask> Tasks { get; }
    DbSet<Approval> Approvals { get; }
    DbSet<AssignmentHistory> AssignmentHistories { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<RoutingRule> RoutingRules { get; }
    DbSet<Project> Projects { get; }
    DbSet<ProjectStage> ProjectStages { get; }
    DbSet<ProjectDepartment> ProjectDepartments { get; }
    DbSet<ProjectMember> ProjectMembers { get; }
    DbSet<PushSubscription> PushSubscriptions { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}