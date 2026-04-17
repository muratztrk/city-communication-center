namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record AddProjectMemberCommand(
    Guid ProjectId,
    Guid? ActorUserId,
    Guid UserId,
    Guid DepartmentId) : ICommand<bool>;

public sealed class AddProjectMemberCommandHandler : IRequestHandler<AddProjectMemberCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public AddProjectMemberCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<bool> Handle(AddProjectMemberCommand request, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .FirstOrDefaultAsync(entity => entity.ProjectId == request.ProjectId, cancellationToken);
        if (project is null) return false;

        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == request.ActorUserId!.Value, cancellationToken);
        if (actor is null) return false;

        if (actor.RoleCode != RoleCode.SystemAdmin)
        {
            var dept = await _dbContext.Departments
                .FirstOrDefaultAsync(entity => entity.DepartmentId == request.DepartmentId, cancellationToken);
            if (dept?.ManagerUserId != actor.UserId) return false;
        }

        var exists = await _dbContext.ProjectMembers
            .AnyAsync(entity => entity.ProjectId == request.ProjectId && entity.UserId == request.UserId, cancellationToken);
        if (exists) return true;

        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;

        _dbContext.ProjectMembers.Add(new ProjectMember
        {
            ProjectMemberId = Guid.NewGuid(),
            TenantId = tenantId,
            ProjectId = request.ProjectId,
            UserId = request.UserId,
            DepartmentId = request.DepartmentId,
            CreatedByUserId = request.ActorUserId,
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
