using System.Text.Json;

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
                .Where(entity => entity.TenantId == tenantId
                    && (entity.ManagerUserId == user.UserId || entity.DeputyManagerUserId == user.UserId))
                .Select(entity => entity.DepartmentId)
                .ToListAsync(cancellationToken);

            foreach (var id in managedIds)
            {
                ids.Add(id);
            }
        }

        var responsibleDepartments = await dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => new { entity.DepartmentId, entity.ResponsibleUserIdsJson })
            .ToListAsync(cancellationToken);

        foreach (var department in responsibleDepartments)
        {
            if (ParseResponsibleUserIds(department.ResponsibleUserIdsJson).Contains(user.UserId))
            {
                ids.Add(department.DepartmentId);
            }
        }

        return ids.ToArray();
    }

    public static async Task<Guid[]> GetMembershipDepartmentIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser user,
        CancellationToken cancellationToken)
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

        return ids.ToArray();
    }

    public static async Task<IReadOnlyList<DepartmentSummaryResponse>> GetMembershipDepartmentSummariesAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser user,
        CancellationToken cancellationToken)
    {
        var ids = await GetMembershipDepartmentIdsAsync(dbContext, tenantId, user, cancellationToken);

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

    public static async Task<HashSet<Guid>> GetStaffUserIdsForDepartmentsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        IEnumerable<Guid> departmentIds,
        CancellationToken cancellationToken)
    {
        var departmentIdArray = departmentIds.Distinct().ToArray();
        if (departmentIdArray.Length == 0)
        {
            return [];
        }

        var primaryStaffIds = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == tenantId
                && user.IsActive
                && user.RoleCode == RoleCode.Staff
                && departmentIdArray.Contains(user.DepartmentId))
            .Select(user => user.UserId)
            .ToListAsync(cancellationToken);

        var additionalStaffIds = await dbContext.UserDepartmentAssignments
            .AsNoTracking()
            .Where(assignment => assignment.TenantId == tenantId
                && departmentIdArray.Contains(assignment.DepartmentId)
                && dbContext.Users.Any(user => user.UserId == assignment.UserId
                    && user.TenantId == tenantId
                    && user.IsActive
                    && user.RoleCode == RoleCode.Staff))
            .Select(assignment => assignment.UserId)
            .ToListAsync(cancellationToken);

        return primaryStaffIds.Concat(additionalStaffIds).ToHashSet();
    }

    private static IReadOnlyCollection<Guid> ParseResponsibleUserIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<Guid[]>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
