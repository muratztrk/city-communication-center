namespace CityCommunicationCenter.Application.Features.Tasks;

internal static class TaskSummaryResponseFactory
{
    public static async Task<TaskSummaryResponse> CreateAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        CancellationToken cancellationToken)
    {
        var job = await dbContext.Jobs
            .Where(entity => entity.JobId == task.JobId)
            .Select(entity => new
            {
                entity.Title,
                entity.RequestType,
                entity.SourceType,
                entity.JobNumber,
                entity.JobNumberYear,
                entity.OwnerDepartmentId
            })
            .FirstOrDefaultAsync(cancellationToken);
        var assignedDepartmentName = await GetDepartmentNameAsync(dbContext, task.AssignedDepartmentId, cancellationToken);
        var ownerDepartmentName = await GetDepartmentNameAsync(dbContext, job?.OwnerDepartmentId, cancellationToken);
        var assignedUserDisplayName = await GetUserDisplayNameAsync(dbContext, task.AssignedUserId, cancellationToken);
        var createdByDisplayName = await GetUserDisplayNameAsync(dbContext, task.CreatedByUserId, cancellationToken);
        var ownerDisplayName = await GetUserDisplayNameAsync(dbContext, task.OwnerUserId, cancellationToken);

        return new TaskSummaryResponse(
            task.TaskId,
            task.TenantId,
            task.JobId,
            job?.Title,
            job is null ? null : job.RequestType.ToString(),
            job is null ? null : job.SourceType.ToString(),
            job?.JobNumber,
            job?.JobNumberYear,
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
            ownerDisplayName,
            task.TaskNumber,
            task.TaskNumberYear,
            ownerDepartmentName,
            task.CompletedAtUtc,
            task.UpdatedAtUtc,
            AssignedAtUtc: task.AssignedAtUtc);
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
