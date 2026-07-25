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
