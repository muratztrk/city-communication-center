using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record CreateCoordinatedProjectCommand(
    Guid? ActorUserId,
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    List<Guid> DepartmentIds,
    List<CreateProjectStageRequest> Stages) : ICommand<ProjectSummaryResponse>;

public sealed class CreateCoordinatedProjectCommandValidator : AbstractValidator<CreateCoordinatedProjectCommand>
{
    public CreateCoordinatedProjectCommandValidator()
    {
        RuleFor(command => command.Title).NotEmpty().WithMessage("Proje başlığı zorunludur.");
        RuleFor(command => command.Description).NotEmpty().WithMessage("Proje açıklaması zorunludur.");
        RuleFor(command => command.OwnerDepartmentId).NotEmpty().WithMessage("Koordinatör birim seçimi zorunludur.");
        RuleFor(command => command.DepartmentIds)
            .NotNull().WithMessage("Dahil olan müdürlükler zorunludur.")
            .Must(ids => ids is { Count: >= 2 })
            .WithMessage("Koordineli projede en az 2 müdürlük dahil edilmelidir.");
    }
}

public sealed class CreateCoordinatedProjectCommandHandler : IRequestHandler<CreateCoordinatedProjectCommand, ProjectSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public CreateCoordinatedProjectCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async Task<ProjectSummaryResponse> Handle(CreateCoordinatedProjectCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;
        var actorUserId = request.ActorUserId!.Value;

        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == actorUserId, cancellationToken)
            ?? throw new InvalidOperationException("Kullanıcı bulunamadı.");

        // Verify all departments exist
        var departmentIds = request.DepartmentIds.Distinct().ToList();
        var departments = await _dbContext.Departments
            .Where(entity => departmentIds.Contains(entity.DepartmentId))
            .ToListAsync(cancellationToken);

        if (departments.Count < 2)
            throw new InvalidOperationException("En az 2 geçerli müdürlük gereklidir.");

        var project = new Project
        {
            ProjectId = Guid.NewGuid(),
            TenantId = tenantId,
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            ProjectType = ProjectType.Coordinated,
            Status = ProjectStatus.Planned,
            OwnerDepartmentId = request.OwnerDepartmentId,
            RequiresApproval = false,
            IsApproved = true,
            CreatedByUserId = actorUserId,
        };

        _dbContext.Projects.Add(project);

        // Add participating departments - coordinator department auto-approved, others pending
        foreach (var deptId in departmentIds)
        {
            var isCoordinator = deptId == request.OwnerDepartmentId;
            var dept = departments.First(d => d.DepartmentId == deptId);

            // Auto-approve if actor is the manager of this department
            var isActorManager = dept.ManagerUserId == actorUserId || actor.RoleCode == RoleCode.SystemAdmin;

            _dbContext.ProjectDepartments.Add(new ProjectDepartment
            {
                ProjectDepartmentId = Guid.NewGuid(),
                TenantId = tenantId,
                ProjectId = project.ProjectId,
                DepartmentId = deptId,
                ApprovalStatus = (isCoordinator || isActorManager)
                    ? ProjectDepartmentApprovalStatus.Approved
                    : ProjectDepartmentApprovalStatus.Pending,
                ApprovedByUserId = (isCoordinator || isActorManager) ? actorUserId : null,
                ApprovalDateUtc = (isCoordinator || isActorManager) ? DateTimeOffset.UtcNow : null,
                CreatedByUserId = actorUserId,
            });
        }

        // Add stages
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
                    ResponsibleDepartmentId = stageRequest.ResponsibleDepartmentId,
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
            Action = "CoordinatedProjectCreated",
            ActorUserId = actorUserId,
            Details = $"Departments: {string.Join(", ", departmentIds)}",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Send notifications to managers of departments that need approval
        var pendingDepartments = departments
            .Where(d => d.DepartmentId != request.OwnerDepartmentId
                        && d.ManagerUserId.HasValue
                        && d.ManagerUserId != actorUserId)
            .ToList();

        foreach (var dept in pendingDepartments)
        {
            var notification = new Notification
            {
                NotificationId = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = dept.ManagerUserId!.Value,
                Channel = NotificationChannel.InApp,
                DeliveryStatus = NotificationDeliveryStatus.Pending,
                Title = "Koordineli Proje Daveti",
                Message = $"'{project.Title}' koordineli projesine müdürlüğünüz davet edildi.",
                ActionUrl = $"/projects/{project.ProjectId}",
                CreatedByUserId = actorUserId,
            };

            _dbContext.Notifications.Add(notification);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await _notificationPushService.SendToUserAsync(
                tenantId,
                dept.ManagerUserId!.Value,
                new NotificationPayload(notification.NotificationId, notification.Title, notification.Message, notification.ActionUrl),
                cancellationToken);
        }

        return await ProjectSummaryResponseFactory.CreateAsync(_dbContext, project, cancellationToken);
    }
}
