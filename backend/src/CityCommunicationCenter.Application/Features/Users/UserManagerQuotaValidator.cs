namespace CityCommunicationCenter.Application.Features.Users;

internal static class UserManagerQuotaValidator
{
    public static async Task<bool> IsManagerSeatTakenAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid? currentUserId,
        CancellationToken cancellationToken)
    {
        return await dbContext.Users
            .AsNoTracking()
            .AnyAsync(user => user.TenantId == tenantId
                && user.DepartmentId == departmentId
                && user.RoleCode == RoleCode.Manager
                && (!currentUserId.HasValue || user.UserId != currentUserId.Value),
                cancellationToken);
    }

    public static async Task EnsureSingleManagerPerDepartmentAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid departmentId,
        Guid? currentUserId,
        CancellationToken cancellationToken)
    {
        var existingManagerName = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.TenantId == tenantId
                && user.DepartmentId == departmentId
                && user.RoleCode == RoleCode.Manager
                && (!currentUserId.HasValue || user.UserId != currentUserId.Value))
            .Select(user => user.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);

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
}
