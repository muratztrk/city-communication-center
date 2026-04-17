namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record ApproveDepartmentJoinCommand(
    Guid ProjectDepartmentId,
    Guid? ActorUserId) : ICommand<bool>;

public sealed class ApproveDepartmentJoinCommandHandler : IRequestHandler<ApproveDepartmentJoinCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly INotificationPushService _notificationPushService;

    public ApproveDepartmentJoinCommandHandler(
        IApplicationDbContext dbContext,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _notificationPushService = notificationPushService;
    }

    public async Task<bool> Handle(ApproveDepartmentJoinCommand request, CancellationToken cancellationToken)
    {
        var projectDept = await _dbContext.ProjectDepartments
            .FirstOrDefaultAsync(entity => entity.ProjectDepartmentId == request.ProjectDepartmentId, cancellationToken);

        if (projectDept is null || projectDept.ApprovalStatus != ProjectDepartmentApprovalStatus.Pending)
            return false;

        // Only the manager of the target department can approve joining
        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == request.ActorUserId!.Value, cancellationToken);
        if (actor is null) return false;

        if (actor.RoleCode != RoleCode.SystemAdmin)
        {
            var department = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == projectDept.DepartmentId, cancellationToken);
            if (department?.ManagerUserId != actor.UserId) return false;
        }

        projectDept.ApprovalStatus = ProjectDepartmentApprovalStatus.Approved;
        projectDept.ApprovedByUserId = actor.UserId;
        projectDept.ApprovalDateUtc = DateTimeOffset.UtcNow;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = projectDept.TenantId,
            EntityType = nameof(ProjectDepartment),
            EntityId = projectDept.ProjectDepartmentId.ToString(),
            Action = "DepartmentJoinApproved",
            ActorUserId = actor.UserId,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        var project = await _dbContext.Projects
            .FirstOrDefaultAsync(entity => entity.ProjectId == projectDept.ProjectId, cancellationToken);

        if (project?.CreatedByUserId is not null)
        {
            var dept = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == projectDept.DepartmentId, cancellationToken);

            var notification = new Notification
            {
                NotificationId = Guid.NewGuid(),
                TenantId = projectDept.TenantId,
                UserId = project.CreatedByUserId.Value,
                Channel = NotificationChannel.InApp,
                DeliveryStatus = NotificationDeliveryStatus.Pending,
                Title = "Müdürlük Katılımı Onaylandı",
                Message = $"'{dept?.Name ?? "Birim"}' müdürlüğü '{project.Title}' projesine katılımı onayladı.",
                ActionUrl = $"/projects/{project.ProjectId}",
                CreatedByUserId = actor.UserId,
            };

            _dbContext.Notifications.Add(notification);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await _notificationPushService.SendToUserAsync(
                projectDept.TenantId,
                project.CreatedByUserId.Value,
                new NotificationPayload(notification.NotificationId, notification.Title, notification.Message, notification.ActionUrl),
                cancellationToken);
        }

        return true;
    }
}
