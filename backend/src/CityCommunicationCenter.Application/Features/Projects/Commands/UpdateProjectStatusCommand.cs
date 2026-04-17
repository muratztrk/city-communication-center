namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record UpdateProjectStatusCommand(
    Guid ProjectId,
    Guid? ActorUserId,
    string Status) : ICommand<bool>;

public sealed class UpdateProjectStatusCommandHandler : IRequestHandler<UpdateProjectStatusCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateProjectStatusCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(UpdateProjectStatusCommand request, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .FirstOrDefaultAsync(entity => entity.ProjectId == request.ProjectId, cancellationToken);

        if (project is null) return false;

        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == request.ActorUserId!.Value, cancellationToken);
        if (actor is null) return false;

        if (actor.RoleCode != RoleCode.SystemAdmin)
        {
            var department = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == project.OwnerDepartmentId, cancellationToken);
            if (department?.ManagerUserId != actor.UserId) return false;
        }

        if (!Enum.TryParse<ProjectStatus>(request.Status, true, out var newStatus))
            return false;

        project.Status = newStatus;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = project.TenantId,
            EntityType = nameof(Project),
            EntityId = project.ProjectId.ToString(),
            Action = "ProjectStatusUpdated",
            ActorUserId = actor.UserId,
            Details = $"Status changed to {newStatus}",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
