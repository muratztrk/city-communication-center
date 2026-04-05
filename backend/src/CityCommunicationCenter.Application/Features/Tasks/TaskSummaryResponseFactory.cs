namespace CityCommunicationCenter.Application.Features.Tasks;

internal static class TaskSummaryResponseFactory
{
    public static async Task<TaskSummaryResponse> CreateAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        CancellationToken cancellationToken)
    {
        var targetDepartmentName = await GetDepartmentNameAsync(dbContext, task.TargetDepartmentId, cancellationToken);
        var assignedDepartmentName = task.AssignedDepartmentId == task.TargetDepartmentId
            ? targetDepartmentName
            : await GetDepartmentNameAsync(dbContext, task.AssignedDepartmentId, cancellationToken);
        var assignedUserDisplayName = await GetUserDisplayNameAsync(dbContext, task.AssignedUserId, cancellationToken);

        return new TaskSummaryResponse(
            task.TaskId,
            task.TenantId,
            task.Title,
            task.TaskType.ToString(),
            task.Priority,
            task.CurrentStatus.ToString(),
            task.TargetDepartmentId,
            targetDepartmentName,
            task.AssignedDepartmentId,
            assignedDepartmentName,
            task.AssignedUserId,
            assignedUserDisplayName,
            task.DueDateUtc);
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