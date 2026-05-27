namespace CityCommunicationCenter.Application.Features.Users;

internal static class UserDepartmentAccess
{
    public static async Task<Guid[]> GetAccessibleDepartmentIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser user,
        CancellationToken cancellationToken,
        bool includeManagedDepartments = true)
    {
        var ids = new HashSet<Guid> { user.DepartmentId };

        var assignedIds = await dbContext.UserDepartmentAssignments
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId && entity.UserId == user.UserId)
            .Select(entity => entity.DepartmentId)
            .ToListAsync(cancellationToken);

        foreach (var id in assignedIds)
        {
            ids.Add(id);
        }

        if (includeManagedDepartments && user.RoleCode == RoleCode.Manager)
        {
            var managedIds = await dbContext.Departments
                .AsNoTracking()
                .Where(entity => entity.TenantId == tenantId && entity.ManagerUserId == user.UserId)
                .Select(entity => entity.DepartmentId)
                .ToListAsync(cancellationToken);

            foreach (var id in managedIds)
            {
                ids.Add(id);
            }
        }

        return ids.ToArray();
    }

    public static async Task<Guid[]> GetScopedDepartmentIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser user,
        Guid? activeDepartmentId,
        CancellationToken cancellationToken,
        bool includeManagedDepartments = true)
    {
        var accessibleIds = await GetAccessibleDepartmentIdsAsync(
            dbContext,
            tenantId,
            user,
            cancellationToken,
            includeManagedDepartments);

        return activeDepartmentId.HasValue && accessibleIds.Contains(activeDepartmentId.Value)
            ? [activeDepartmentId.Value]
            : accessibleIds;
    }

    public static async Task<bool> CanWorkInDepartmentAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser user,
        Guid departmentId,
        CancellationToken cancellationToken,
        bool includeManagedDepartments = true)
    {
        var accessibleIds = await GetAccessibleDepartmentIdsAsync(
            dbContext,
            tenantId,
            user,
            cancellationToken,
            includeManagedDepartments);

        return accessibleIds.Contains(departmentId);
    }

    public static async Task<Guid> GetDefaultDepartmentIdAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser user,
        Guid? preferredDepartmentId,
        CancellationToken cancellationToken,
        bool includeManagedDepartments = true)
    {
        var accessibleIds = await GetAccessibleDepartmentIdsAsync(
            dbContext,
            tenantId,
            user,
            cancellationToken,
            includeManagedDepartments);

        return preferredDepartmentId.HasValue && accessibleIds.Contains(preferredDepartmentId.Value)
            ? preferredDepartmentId.Value
            : user.DepartmentId;
    }

    public static async Task<IReadOnlyList<DepartmentSummaryResponse>> GetDepartmentSummariesAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser user,
        CancellationToken cancellationToken)
    {
        var ids = await GetAccessibleDepartmentIdsAsync(
            dbContext,
            tenantId,
            user,
            cancellationToken);

        var departments = await dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId && ids.Contains(entity.DepartmentId))
            .Select(entity => new DepartmentSummaryResponse(
                entity.DepartmentId,
                entity.Name,
                entity.DepartmentType,
                entity.DepartmentId == user.DepartmentId))
            .ToListAsync(cancellationToken);

        return departments
            .OrderByDescending(entity => entity.IsPrimary)
            .ThenBy(entity => entity.Name)
            .ToList();
    }

    public static async Task ReplaceAdditionalAssignmentsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        Guid primaryDepartmentId,
        IReadOnlyCollection<Guid>? additionalDepartmentIds,
        Guid? actorUserId,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        var normalizedIds = additionalDepartmentIds?
            .Where(id => id != Guid.Empty && id != primaryDepartmentId)
            .Distinct()
            .ToArray() ?? [];

        if (normalizedIds.Length > 0)
        {
            var existingDepartmentCount = await dbContext.Departments
                .AsNoTracking()
                .Where(entity => entity.TenantId == tenantId && normalizedIds.Contains(entity.DepartmentId))
                .CountAsync(cancellationToken);

            if (existingDepartmentCount != normalizedIds.Length)
            {
                throw new ValidationException([
                    new FluentValidation.Results.ValidationFailure(nameof(additionalDepartmentIds), "Secilen ek mudurluklerden biri bulunamadi.")
                ]);
            }
        }

        var currentAssignments = await dbContext.UserDepartmentAssignments
            .Where(entity => entity.TenantId == tenantId && entity.UserId == userId)
            .ToListAsync(cancellationToken);

        foreach (var assignment in currentAssignments.Where(entity => !normalizedIds.Contains(entity.DepartmentId)))
        {
            dbContext.UserDepartmentAssignments.Remove(assignment);
        }

        var existingIds = currentAssignments.Select(entity => entity.DepartmentId).ToHashSet();
        foreach (var departmentId in normalizedIds.Where(id => !existingIds.Contains(id)))
        {
            dbContext.UserDepartmentAssignments.Add(new UserDepartmentAssignment
            {
                AssignmentId = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                DepartmentId = departmentId,
                IsPrimary = false,
                CreatedAtUtc = utcNow,
                CreatedByUserId = actorUserId,
            });
        }
    }
}
