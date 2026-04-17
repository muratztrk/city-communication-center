namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record ApproveDirectorateProjectCommand(
    Guid ProjectId,
    Guid? ActorUserId) : ICommand<bool>;

public sealed class ApproveDirectorateProjectCommandHandler : IRequestHandler<ApproveDirectorateProjectCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly INotificationPushService _notificationPushService;

    public ApproveDirectorateProjectCommandHandler(
        IApplicationDbContext dbContext,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _notificationPushService = notificationPushService;
    }

    public async Task<bool> Handle(ApproveDirectorateProjectCommand request, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .FirstOrDefaultAsync(entity => entity.ProjectId == request.ProjectId, cancellationToken);

        if (project is null || project.ProjectType != ProjectType.Directorate) return false;
        if (!project.RequiresApproval || project.IsApproved) return false;

        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == request.ActorUserId!.Value, cancellationToken);

        if (actor is null) return false;

        var department = await _dbContext.Departments
            .FirstOrDefaultAsync(entity => entity.DepartmentId == project.OwnerDepartmentId, cancellationToken);

        if (actor.RoleCode != RoleCode.SystemAdmin && department?.ManagerUserId != actor.UserId)
            return false;

        project.IsApproved = true;
        project.ApprovedByUserId = actor.UserId;
        project.ApprovedAtUtc = DateTimeOffset.UtcNow;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = project.TenantId,
            EntityType = nameof(Project),
            EntityId = project.ProjectId.ToString(),
            Action = "DirectorateProjectApproved",
            ActorUserId = actor.UserId,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            TenantId = project.TenantId,
            UserId = project.CreatedByUserId!.Value,
            Channel = NotificationChannel.InApp,
            DeliveryStatus = NotificationDeliveryStatus.Pending,
            Title = "Proje Onaylandı",
            Message = $"'{project.Title}' projeniz onaylandı.",
            ActionUrl = $"/projects/{project.ProjectId}",
            CreatedByUserId = actor.UserId,
        };

        _dbContext.Notifications.Add(notification);
        await _dbContext.SaveChangesAsync(cancellationToken);

        await _notificationPushService.SendToUserAsync(
            project.TenantId,
            project.CreatedByUserId!.Value,
            new NotificationPayload(notification.NotificationId, notification.Title, notification.Message, notification.ActionUrl),
            cancellationToken);

        return true;
    }
}
