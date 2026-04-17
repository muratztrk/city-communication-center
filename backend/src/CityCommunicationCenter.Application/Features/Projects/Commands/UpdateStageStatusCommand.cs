namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record UpdateStageStatusCommand(
    Guid StageId,
    Guid? ActorUserId,
    string Status) : ICommand<bool>;

public sealed class UpdateStageStatusCommandHandler : IRequestHandler<UpdateStageStatusCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateStageStatusCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<bool> Handle(UpdateStageStatusCommand request, CancellationToken cancellationToken)
    {
        var stage = await _dbContext.ProjectStages
            .FirstOrDefaultAsync(entity => entity.StageId == request.StageId, cancellationToken);
        if (stage is null) return false;

        var project = await _dbContext.Projects
            .FirstOrDefaultAsync(entity => entity.ProjectId == stage.ProjectId, cancellationToken);
        if (project is null) return false;

        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == request.ActorUserId!.Value, cancellationToken);
        if (actor is null) return false;

        if (actor.RoleCode != RoleCode.SystemAdmin)
        {
            var responsibleDeptId = stage.ResponsibleDepartmentId ?? project.OwnerDepartmentId;
            var dept = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == responsibleDeptId, cancellationToken);
            if (dept?.ManagerUserId != actor.UserId) return false;
        }

        if (!Enum.TryParse<ProjectStageStatus>(request.Status, true, out var newStatus))
            return false;

        stage.Status = newStatus;
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
