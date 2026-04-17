namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record RejectDepartmentJoinCommand(
    Guid ProjectDepartmentId,
    Guid? ActorUserId) : ICommand<bool>;

public sealed class RejectDepartmentJoinCommandHandler : IRequestHandler<RejectDepartmentJoinCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly INotificationPushService _notificationPushService;

    public RejectDepartmentJoinCommandHandler(
        IApplicationDbContext dbContext,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _notificationPushService = notificationPushService;
    }

    public async Task<bool> Handle(RejectDepartmentJoinCommand request, CancellationToken cancellationToken)
    {
        var projectDept = await _dbContext.ProjectDepartments
            .FirstOrDefaultAsync(entity => entity.ProjectDepartmentId == request.ProjectDepartmentId, cancellationToken);

        if (projectDept is null || projectDept.ApprovalStatus != ProjectDepartmentApprovalStatus.Pending)
            return false;

        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == request.ActorUserId!.Value, cancellationToken);
        if (actor is null) return false;

        if (actor.RoleCode != RoleCode.SystemAdmin)
        {
            var department = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == projectDept.DepartmentId, cancellationToken);
            if (department?.ManagerUserId != actor.UserId) return false;
        }

        projectDept.ApprovalStatus = ProjectDepartmentApprovalStatus.Rejected;
        projectDept.ApprovedByUserId = actor.UserId;
        projectDept.ApprovalDateUtc = DateTimeOffset.UtcNow;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = projectDept.TenantId,
            EntityType = nameof(ProjectDepartment),
            EntityId = projectDept.ProjectDepartmentId.ToString(),
            Action = "DepartmentJoinRejected",
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
                Title = "Müdürlük Katılımı Reddedildi",
                Message = $"'{dept?.Name ?? "Birim"}' müdürlüğü '{project.Title}' projesine katılımı reddetti.",
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
