namespace CityCommunicationCenter.Application.Abstractions;

public interface IApplicationDbContext
{
    DbSet<Tenant> Tenants { get; }
    DbSet<TenantSetting> TenantSettings { get; }
    DbSet<Department> Departments { get; }
    DbSet<ApplicationUser> Users { get; }
    DbSet<CitizenConversation> CitizenConversations { get; }
    DbSet<WhatsAppMessageTemplate> WhatsAppTemplates { get; }
    DbSet<SocialMessage> SocialMessages { get; }
    DbSet<SocialConversationEntry> ConversationEntries { get; }
    DbSet<Job> Jobs { get; }
    DbSet<JobDepartment> JobDepartments { get; }
    DbSet<WorkTask> Tasks { get; }
    DbSet<WorkflowApproval> Approvals { get; }
    DbSet<AssignmentHistory> AssignmentHistories { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<NotificationReadCursor> NotificationReadCursors { get; }
    DbSet<NotificationAuditRead> NotificationAuditReads { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<RoutingRule> RoutingRules { get; }
    DbSet<PushSubscription> PushSubscriptions { get; }
    DbSet<UserQuickReplyTemplate> UserQuickReplyTemplates { get; }
    DbSet<Attachment> Attachments { get; }
    DbSet<UserDepartmentAssignment> UserDepartmentAssignments { get; }
    DbSet<EDevletActivityType> EDevletActivityTypes { get; }
    DbSet<EDevletDailyActivityPlan> EDevletDailyActivityPlans { get; }
    DbSet<EDevletBasvuru> EDevletBasvurular { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
