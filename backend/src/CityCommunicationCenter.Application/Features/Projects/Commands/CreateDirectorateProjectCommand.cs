using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record CreateDirectorateProjectCommand(
    Guid? ActorUserId,
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    List<CreateProjectStageRequest> Stages) : ICommand<ProjectSummaryResponse>;

public sealed class CreateDirectorateProjectCommandValidator : AbstractValidator<CreateDirectorateProjectCommand>
{
    public CreateDirectorateProjectCommandValidator()
    {
        RuleFor(command => command.Title).NotEmpty().WithMessage("Proje başlığı zorunludur.");
        RuleFor(command => command.Description).NotEmpty().WithMessage("Proje açıklaması zorunludur.");
        RuleFor(command => command.OwnerDepartmentId).NotEmpty().WithMessage("Birim seçimi zorunludur.");
    }
}

public sealed class CreateDirectorateProjectCommandHandler : IRequestHandler<CreateDirectorateProjectCommand, ProjectSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public CreateDirectorateProjectCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async Task<ProjectSummaryResponse> Handle(CreateDirectorateProjectCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;
        var actorUserId = request.ActorUserId!.Value;

        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == actorUserId, cancellationToken)
            ?? throw new InvalidOperationException("Kullanıcı bulunamadı.");

        var department = await _dbContext.Departments
            .FirstOrDefaultAsync(entity => entity.DepartmentId == request.OwnerDepartmentId, cancellationToken)
            ?? throw new InvalidOperationException("Müdürlük bulunamadı.");

        bool requiresApproval = false;
        bool isApproved = false;

        if (actor.RoleCode == RoleCode.SystemAdmin)
        {
            isApproved = true;
        }
        else if (actor.RoleCode == RoleCode.Manager && department.ManagerUserId == actorUserId)
        {
            isApproved = true;
        }
        else if (actor.RoleCode == RoleCode.Manager && actor.DepartmentId == request.OwnerDepartmentId)
        {
            isApproved = true;
        }
        else
        {
            requiresApproval = true;
        }

        var project = new Project
        {
            ProjectId = Guid.NewGuid(),
            TenantId = tenantId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            ProjectType = ProjectType.Directorate,
            Status = ProjectStatus.Planned,
            OwnerDepartmentId = request.OwnerDepartmentId,
            RequiresApproval = requiresApproval,
            IsApproved = isApproved,
            CreatedByUserId = actorUserId,
        };

        _dbContext.Projects.Add(project);

        if (request.Stages is { Count: > 0 })
        {
            foreach (var stageRequest in request.Stages)
            {
                _dbContext.ProjectStages.Add(new ProjectStage
                {
                    StageId = Guid.NewGuid(),
                    TenantId = tenantId,
                    ProjectId = project.ProjectId,
                    Title = stageRequest.Title.Trim(),
                    Description = stageRequest.Description?.Trim() ?? string.Empty,
                    DisplayOrder = stageRequest.DisplayOrder,
                    Status = ProjectStageStatus.Planned,
                    ResponsibleDepartmentId = request.OwnerDepartmentId,
                    CreatedByUserId = actorUserId,
                });
            }
        }

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Project),
            EntityId = project.ProjectId.ToString(),
            Action = "DirectorateProjectCreated",
            ActorUserId = actorUserId,
            Details = requiresApproval ? "Onay bekliyor" : null,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        if (requiresApproval && department.ManagerUserId.HasValue)
        {
            var notification = new Notification
            {
                NotificationId = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = department.ManagerUserId.Value,
                Channel = NotificationChannel.InApp,
                DeliveryStatus = NotificationDeliveryStatus.Pending,
                Title = "Yeni Proje Onay Talebi",
                Message = $"'{project.Title}' projesi onayınızı bekliyor.",
                ActionUrl = $"/projects/{project.ProjectId}",
                CreatedByUserId = actorUserId,
            };

            _dbContext.Notifications.Add(notification);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await _notificationPushService.SendToUserAsync(
                tenantId,
                department.ManagerUserId.Value,
                new NotificationPayload(notification.NotificationId, notification.Title, notification.Message, notification.ActionUrl),
                cancellationToken);
        }

        return await ProjectSummaryResponseFactory.CreateAsync(_dbContext, project, cancellationToken);
    }
}
