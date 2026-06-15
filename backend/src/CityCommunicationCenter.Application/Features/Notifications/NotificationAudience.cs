namespace CityCommunicationCenter.Application.Features.Notifications;

internal static class NotificationAudience
{
    public static async Task<IReadOnlyList<string>> GetVisibleEntityIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var jobIds = await dbContext.Jobs
            .AsNoTracking()
            .Where(job => job.TenantId == tenantId && job.CreatedByUserId == userId)
            .Select(job => job.JobId.ToString())
            .ToListAsync(cancellationToken);

        var taskIds = await dbContext.Tasks
            .AsNoTracking()
            .Where(task =>
                task.TenantId == tenantId
                && (task.AssignedUserId == userId
                    || task.OwnerUserId == userId
                    || task.CreatedByUserId == userId))
            .Select(task => task.TaskId.ToString())
            .ToListAsync(cancellationToken);

        return jobIds.Concat(taskIds).Distinct().ToList();
    }

    public static async Task<NotificationReadCursor> GetOrCreateCursorAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var cursor = await dbContext.NotificationReadCursors
            .SingleOrDefaultAsync(
                entity => entity.TenantId == tenantId && entity.UserId == userId,
                cancellationToken);
        if (cursor is not null)
        {
            return cursor;
        }

        cursor = new NotificationReadCursor
        {
            NotificationReadCursorId = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            CreatedByUserId = userId,
        };
        dbContext.NotificationReadCursors.Add(cursor);
        return cursor;
    }
}
