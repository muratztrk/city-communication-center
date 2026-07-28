using System.Text.Json;
using CityCommunicationCenter.Application.Features.Departments;

namespace CityCommunicationCenter.Application.Features.Users;

internal static class UserManagerQuotaValidator
{
    /// <summary>
    /// Müdür kontenjanı: birimdeki Manager rolünden Sorumlu listesindekiler hariç
    /// (veya açıkça ManagerUserId olan) kullanıcı (card #1898).
    /// </summary>
    public static async Task<bool> IsManagerSeatTakenAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid? currentUserId,
        CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId && entity.DepartmentId == departmentId)
            .Select(entity => new { entity.ManagerUserId, entity.ResponsibleUserIdsJson })
            .FirstOrDefaultAsync(cancellationToken);

        if (department is null)
        {
            return false;
        }

        var responsibleUserIds = ParseResponsibleUserIds(department.ResponsibleUserIdsJson);

        if (department.ManagerUserId.HasValue)
        {
            if (currentUserId.HasValue && department.ManagerUserId.Value == currentUserId.Value)
            {
                return false;
            }

            return await dbContext.Users
                .AsNoTracking()
                .AnyAsync(user => user.TenantId == tenantId
                    && user.UserId == department.ManagerUserId.Value
                    && user.RoleCode == RoleCode.Manager,
                    cancellationToken);
        }

        var responsibleSet = responsibleUserIds.ToHashSet();
        var candidateIds = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == tenantId
                && user.DepartmentId == departmentId
                && user.RoleCode == RoleCode.Manager
                && (!currentUserId.HasValue || user.UserId != currentUserId.Value))
            .Select(user => user.UserId)
            .ToListAsync(cancellationToken);

        return candidateIds.Any(userId => !responsibleSet.Contains(userId));
    }

    public static async Task EnsureSingleManagerPerDepartmentAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid? currentUserId,
        CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId && entity.DepartmentId == departmentId)
            .Select(entity => new { entity.ManagerUserId, entity.ResponsibleUserIdsJson })
            .FirstOrDefaultAsync(cancellationToken);

        if (department is null)
        {
            return;
        }

        var responsibleUserIds = ParseResponsibleUserIds(department.ResponsibleUserIdsJson);
        string? existingManagerName = null;

        if (department.ManagerUserId.HasValue
            && (!currentUserId.HasValue || department.ManagerUserId.Value != currentUserId.Value))
        {
            existingManagerName = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.TenantId == tenantId
                    && user.UserId == department.ManagerUserId.Value
                    && user.RoleCode == RoleCode.Manager)
                .Select(user => user.DisplayName)
                .FirstOrDefaultAsync(cancellationToken);
        }
        else if (!department.ManagerUserId.HasValue)
        {
            var responsibleSet = responsibleUserIds.ToHashSet();
            var candidates = await dbContext.Users
                .AsNoTracking()
                .Where(user => user.TenantId == tenantId
                    && user.DepartmentId == departmentId
                    && user.RoleCode == RoleCode.Manager
                    && (!currentUserId.HasValue || user.UserId != currentUserId.Value))
                .Select(user => new { user.UserId, user.DisplayName })
                .ToListAsync(cancellationToken);

            existingManagerName = candidates
                .FirstOrDefault(user => !responsibleSet.Contains(user.UserId))
                ?.DisplayName;
        }

        if (!string.IsNullOrWhiteSpace(existingManagerName))
        {
            throw new ValidationException(
            [
                new FluentValidation.Results.ValidationFailure(
                    "RoleCode",
                    $"Bu müdürlükte zaten bir Müdür mevcut: {existingManagerName}. Her müdürlüğün yalnızca 1 müdür kontenjanı vardır."),
            ]);
        }
    }

    /// <summary>
    /// Sorumlu kaydı: kullanıcıyı birimin ResponsibleUserIds listesine ekler;
    /// ManagerUserId ise temizler (card #1898).
    /// </summary>
    public static async Task MarkAsResponsibleAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments
            .FirstOrDefaultAsync(
                entity => entity.TenantId == tenantId && entity.DepartmentId == departmentId,
                cancellationToken);

        if (department is null)
        {
            return;
        }

        var responsibleUserIds = ParseResponsibleUserIds(department.ResponsibleUserIdsJson).ToList();
        if (!responsibleUserIds.Contains(userId))
        {
            responsibleUserIds.Add(userId);
            department.ResponsibleUserIdsJson = DepartmentResponseFactory.SerializeResponsibleUserIds(responsibleUserIds);
        }

        if (department.ManagerUserId == userId)
        {
            department.ManagerUserId = null;
        }
    }

    /// <summary>
    /// Müdür kaydı: ManagerUserId atar; ResponsibleUserIds'den çıkarır (#r513).
    /// </summary>
    public static async Task MarkAsManagerAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments
            .FirstOrDefaultAsync(
                entity => entity.TenantId == tenantId && entity.DepartmentId == departmentId,
                cancellationToken);

        if (department is null)
        {
            return;
        }

        department.ManagerUserId = userId;

        var responsibleUserIds = ParseResponsibleUserIds(department.ResponsibleUserIdsJson).ToList();
        if (responsibleUserIds.Remove(userId))
        {
            department.ResponsibleUserIdsJson = DepartmentResponseFactory.SerializeResponsibleUserIds(responsibleUserIds);
        }
    }

    /// <summary>
    /// Kullanıcıyı birimin müdür/sorumlu koltuklarından çıkarır (#r513).
    /// </summary>
    public static async Task ClearUserFromDepartmentLeadershipAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var department = await dbContext.Departments
            .FirstOrDefaultAsync(
                entity => entity.TenantId == tenantId && entity.DepartmentId == departmentId,
                cancellationToken);

        if (department is null)
        {
            return;
        }

        if (department.ManagerUserId == userId)
        {
            department.ManagerUserId = null;
        }

        var responsibleUserIds = ParseResponsibleUserIds(department.ResponsibleUserIdsJson).ToList();
        if (responsibleUserIds.Remove(userId))
        {
            department.ResponsibleUserIdsJson = DepartmentResponseFactory.SerializeResponsibleUserIds(responsibleUserIds);
        }
    }

    /// <summary>
    /// Yönetici Ata: Müdür/Sorumlular listesine göre RoleCode=Manager yükseltir;
    /// listeden çıkan eski liderleri (başka birimde lider değilse) Personel'e düşürür (#r513).
    /// </summary>
    public static async Task SyncDepartmentLeadershipRolesAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid? previousManagerUserId,
        IReadOnlyCollection<Guid> previousResponsibleUserIds,
        Guid? nextManagerUserId,
        IReadOnlyCollection<Guid>? nextResponsibleUserIds,
        CancellationToken cancellationToken)
    {
        var nextResponsible = (nextResponsibleUserIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToHashSet();
        var nextLeaders = new HashSet<Guid>(nextResponsible);
        if (nextManagerUserId.HasValue && nextManagerUserId.Value != Guid.Empty)
        {
            nextLeaders.Add(nextManagerUserId.Value);
        }

        if (nextLeaders.Count > 0)
        {
            var leaders = await dbContext.Users
                .Where(user => user.TenantId == tenantId && nextLeaders.Contains(user.UserId))
                .ToListAsync(cancellationToken);

            foreach (var leader in leaders)
            {
                if (leader.RoleCode == RoleCode.SystemAdmin)
                {
                    continue;
                }

                leader.RoleCode = RoleCode.Manager;
            }
        }

        var previousLeaders = previousResponsibleUserIds
            .Where(id => id != Guid.Empty)
            .ToHashSet();
        if (previousManagerUserId.HasValue && previousManagerUserId.Value != Guid.Empty)
        {
            previousLeaders.Add(previousManagerUserId.Value);
        }

        var removedLeaderIds = previousLeaders.Where(id => !nextLeaders.Contains(id)).ToArray();
        if (removedLeaderIds.Length == 0)
        {
            return;
        }

        foreach (var removedUserId in removedLeaderIds)
        {
            var stillLeaderElsewhere = await IsLeadershipSeatElsewhereAsync(
                dbContext,
                tenantId,
                removedUserId,
                excludeDepartmentId: departmentId,
                cancellationToken);

            if (stillLeaderElsewhere)
            {
                continue;
            }

            var user = await dbContext.Users
                .FirstOrDefaultAsync(
                    entity => entity.TenantId == tenantId && entity.UserId == removedUserId,
                    cancellationToken);

            if (user is null || user.RoleCode != RoleCode.Manager)
            {
                continue;
            }

            user.RoleCode = RoleCode.Staff;
        }
    }

    private static async Task<bool> IsLeadershipSeatElsewhereAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid userId,
        Guid excludeDepartmentId,
        CancellationToken cancellationToken)
    {
        var departments = await dbContext.Departments
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId && entity.DepartmentId != excludeDepartmentId)
            .Select(entity => new { entity.ManagerUserId, entity.ResponsibleUserIdsJson })
            .ToListAsync(cancellationToken);

        foreach (var department in departments)
        {
            if (department.ManagerUserId == userId)
            {
                return true;
            }

            if (ParseResponsibleUserIds(department.ResponsibleUserIdsJson).Contains(userId))
            {
                return true;
            }
        }

        return false;
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
