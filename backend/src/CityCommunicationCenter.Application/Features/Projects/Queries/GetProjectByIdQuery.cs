namespace CityCommunicationCenter.Application.Features.Projects;

public sealed record GetProjectByIdQuery(Guid ProjectId) : IQuery<ProjectDetailResponse?>;

public sealed class GetProjectByIdQueryHandler : IRequestHandler<GetProjectByIdQuery, ProjectDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;

    public GetProjectByIdQueryHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ProjectDetailResponse?> Handle(GetProjectByIdQuery request, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.ProjectId == request.ProjectId, cancellationToken);

        if (project is null)
            return null;

        var ownerDepartmentName = await _dbContext.Departments
            .Where(entity => entity.DepartmentId == project.OwnerDepartmentId)
            .Select(entity => entity.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var createdByUserName = project.CreatedByUserId.HasValue
            ? await _dbContext.Users
                .Where(entity => entity.UserId == project.CreatedByUserId.Value)
                .Select(entity => entity.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var stages = await (
            from stage in _dbContext.ProjectStages.AsNoTracking()
            where stage.ProjectId == project.ProjectId
            join dept in _dbContext.Departments.AsNoTracking()
                on stage.ResponsibleDepartmentId equals dept.DepartmentId into departments
            from dept in departments.DefaultIfEmpty()
            orderby stage.DisplayOrder
            select new ProjectStageResponse(
                stage.StageId,
                stage.Title,
                stage.Description,
                stage.DisplayOrder,
                stage.Status.ToString(),
                stage.ResponsibleDepartmentId,
                dept != null ? dept.Name : null))
            .ToListAsync(cancellationToken);

        var projectDepartments = await (
            from pd in _dbContext.ProjectDepartments.AsNoTracking()
            where pd.ProjectId == project.ProjectId
            join dept in _dbContext.Departments.AsNoTracking()
                on pd.DepartmentId equals dept.DepartmentId
            join approver in _dbContext.Users.AsNoTracking()
                on pd.ApprovedByUserId equals approver.UserId into approvers
            from approver in approvers.DefaultIfEmpty()
            select new ProjectDepartmentResponse(
                pd.ProjectDepartmentId,
                pd.DepartmentId,
                dept.Name,
                pd.ApprovalStatus.ToString(),
                pd.ApprovedByUserId,
                approver != null ? approver.DisplayName : null,
                pd.ApprovalDateUtc))
            .ToListAsync(cancellationToken);

        var members = await (
            from pm in _dbContext.ProjectMembers.AsNoTracking()
            where pm.ProjectId == project.ProjectId
            join user in _dbContext.Users.AsNoTracking()
                on pm.UserId equals user.UserId
            join dept in _dbContext.Departments.AsNoTracking()
                on pm.DepartmentId equals dept.DepartmentId
            select new ProjectMemberResponse(
                pm.ProjectMemberId,
                pm.UserId,
                user.DisplayName,
                pm.DepartmentId,
                dept.Name))
            .ToListAsync(cancellationToken);

        return new ProjectDetailResponse(
            project.ProjectId,
            project.TenantId,
            project.Title,
            project.Description,
            project.ProjectType.ToString(),
            project.Status.ToString(),
            project.OwnerDepartmentId,
            ownerDepartmentName,
            project.RequiresApproval,
            project.IsApproved,
            project.ApprovedByUserId,
            project.ApprovedAtUtc,
            project.CreatedAtUtc,
            project.CreatedByUserId,
            createdByUserName,
            stages,
            projectDepartments,
            members);
    }
}
