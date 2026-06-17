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

        // Yöneticinin yönettiği birimlerin dahil olduğu tüm talepler ve görevler de ilgili kullanıcı
        // sayılır; her değişiklik bu yöneticilerin bildirimlerinde görünür (card 541).
        var managerJobIds = await GetManagerInvolvedJobIdsAsync(dbContext, tenantId, userId, cancellationToken);
        var managerTaskIds = await GetManagerDepartmentTaskIdsAsync(dbContext, tenantId, userId, cancellationToken);

        return jobIds
            .Concat(taskIds)
            .Concat(managerJobIds.Select(id => id.ToString()))
            .Concat(managerTaskIds.Select(id => id.ToString()))
            .Distinct()
            .ToList();
    }

    /// <summary>Aktör yöneticiyse, yönettiği birimlerin Id'leri; değilse boş.</summary>
    public static async Task<Guid[]> GetManagedDepartmentIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var actor = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.UserId == userId && user.TenantId == tenantId, cancellationToken);
        if (actor is not { RoleCode: RoleCode.Manager })
        {
            return [];
        }

        return await dbContext.Departments
            .AsNoTracking()
            .Where(department => department.TenantId == tenantId && department.ManagerUserId == userId)
            .Select(department => department.DepartmentId)
            .ToArrayAsync(cancellationToken);
    }

    /// <summary>Yöneticinin birimlerinin sahip/hedef/koordine olduğu tüm talepler (her durum) (card 541).</summary>
    public static async Task<IReadOnlyList<Guid>> GetManagerInvolvedJobIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var managedDepartmentIds = await GetManagedDepartmentIdsAsync(dbContext, tenantId, userId, cancellationToken);
        if (managedDepartmentIds.Length == 0)
        {
            return [];
        }

        return await dbContext.Jobs
            .AsNoTracking()
            .Where(job =>
                job.TenantId == tenantId
                && (managedDepartmentIds.Contains(job.OwnerDepartmentId)
                    || dbContext.JobDepartments.Any(jobDepartment =>
                        jobDepartment.JobId == job.JobId
                        && managedDepartmentIds.Contains(jobDepartment.DepartmentId)
                        && (jobDepartment.Role == JobDepartmentRole.Target || jobDepartment.Role == JobDepartmentRole.Coordinating))))
            .Select(job => job.JobId)
            .ToListAsync(cancellationToken);
    }

    /// <summary>Yöneticinin birimlerine atanmış tüm görevler (card 541).</summary>
    public static async Task<IReadOnlyList<Guid>> GetManagerDepartmentTaskIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var managedDepartmentIds = await GetManagedDepartmentIdsAsync(dbContext, tenantId, userId, cancellationToken);
        if (managedDepartmentIds.Length == 0)
        {
            return [];
        }

        return await dbContext.Tasks
            .AsNoTracking()
            .Where(task =>
                task.TenantId == tenantId
                && task.AssignedDepartmentId != null
                && managedDepartmentIds.Contains(task.AssignedDepartmentId.Value))
            .Select(task => task.TaskId)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// Yöneticinin yönettiği departmanlara ait, onay/aksiyon bekleyen taleplerin Id'leri.
    /// "Birime Gelen → Onay Bekleyen Talepler" (departman hedef/sahip) ve
    /// "Birimden Giden → Bekleyen Talepler" (departman sahip) tek koşulda kapsanır.
    /// </summary>
    public static async Task<IReadOnlyList<Guid>> GetManagerPendingJobIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var actor = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.UserId == userId && user.TenantId == tenantId, cancellationToken);
        if (actor is not { RoleCode: RoleCode.Manager })
        {
            return [];
        }

        var managedDepartmentIds = await dbContext.Departments
            .AsNoTracking()
            .Where(department => department.TenantId == tenantId && department.ManagerUserId == userId)
            .Select(department => department.DepartmentId)
            .ToArrayAsync(cancellationToken);
        if (managedDepartmentIds.Length == 0)
        {
            return [];
        }

        return await dbContext.Jobs
            .AsNoTracking()
            .Where(job =>
                job.TenantId == tenantId
                && (job.Status == JobStatus.PendingOwnerApproval || job.Status == JobStatus.PendingExternalApproval)
                && (managedDepartmentIds.Contains(job.OwnerDepartmentId)
                    || dbContext.JobDepartments.Any(jobDepartment =>
                        jobDepartment.JobId == job.JobId
                        && managedDepartmentIds.Contains(jobDepartment.DepartmentId)
                        && jobDepartment.Role == JobDepartmentRole.Target)))
            .Select(job => job.JobId)
            .ToListAsync(cancellationToken);
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
