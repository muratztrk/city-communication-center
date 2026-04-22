namespace CityCommunicationCenter.Application.Features.Tasks;

internal static class TaskSummaryResponseFactory
{
    public static async Task<TaskSummaryResponse> CreateAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        CancellationToken cancellationToken)
    {
        var jobTitle = await dbContext.Jobs
            .Where(entity => entity.JobId == task.JobId)
            .Select(entity => entity.Title)
            .FirstOrDefaultAsync(cancellationToken);
        var assignedDepartmentName = await GetDepartmentNameAsync(dbContext, task.AssignedDepartmentId, cancellationToken);
        var assignedUserDisplayName = await GetUserDisplayNameAsync(dbContext, task.AssignedUserId, cancellationToken);
        var createdByDisplayName = await GetUserDisplayNameAsync(dbContext, task.CreatedByUserId, cancellationToken);
        var ownerDisplayName = await GetUserDisplayNameAsync(dbContext, task.OwnerUserId, cancellationToken);

        return new TaskSummaryResponse(
            task.TaskId,
            task.TenantId,
            task.JobId,
            jobTitle,
            task.Title,
            task.Priority,
            task.CurrentStatus.ToString(),
            task.AssignedDepartmentId,
            assignedDepartmentName,
            task.AssignedUserId,
            assignedUserDisplayName,
            task.DueDateUtc,
            task.CompletionPercentage,
            task.EstimatedHours,
            task.ActualHours,
            createdByDisplayName,
            task.CreatedAtUtc,
            ownerDisplayName);
    }

    private static Task<string?> GetDepartmentNameAsync(
        IApplicationDbContext dbContext,
        Guid? departmentId,
        CancellationToken cancellationToken)
    {
        if (!departmentId.HasValue)
        {
            return Task.FromResult<string?>(null);
        }

        return dbContext.Departments
            .Where(entity => entity.DepartmentId == departmentId.Value)
            .Select(entity => entity.Name)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static Task<string?> GetUserDisplayNameAsync(
        IApplicationDbContext dbContext,
        Guid? userId,
        CancellationToken cancellationToken)
    {
        if (!userId.HasValue)
        {
            return Task.FromResult<string?>(null);
        }

        return dbContext.Users
            .Where(entity => entity.UserId == userId.Value)
            .Select(entity => entity.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
