namespace CityCommunicationCenter.Application.Features.Projects;

public static class ProjectSummaryResponseFactory
{
    public static async Task<ProjectSummaryResponse> CreateAsync(
        IApplicationDbContext dbContext,
        Project project,
        CancellationToken cancellationToken)
    {
        var ownerDepartmentName = await dbContext.Departments
            .Where(entity => entity.DepartmentId == project.OwnerDepartmentId)
            .Select(entity => entity.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var createdByUserName = project.CreatedByUserId.HasValue
            ? await dbContext.Users
                .Where(entity => entity.UserId == project.CreatedByUserId.Value)
                .Select(entity => entity.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var stageCount = await dbContext.ProjectStages
            .CountAsync(entity => entity.ProjectId == project.ProjectId, cancellationToken);

        var departmentCount = await dbContext.ProjectDepartments
            .CountAsync(entity => entity.ProjectId == project.ProjectId, cancellationToken);

        var memberCount = await dbContext.ProjectMembers
            .CountAsync(entity => entity.ProjectId == project.ProjectId, cancellationToken);

        return new ProjectSummaryResponse(
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
            stageCount,
            departmentCount,
            memberCount,
            project.CreatedAtUtc,
            createdByUserName);
    }
}
