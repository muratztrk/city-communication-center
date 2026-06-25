using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.EDevlet;

internal static class EDevletDepartmentAccess
{
    public static async Task<(ApplicationUser User, Guid[] DepartmentIds)> RequireUserAndDepartmentsAsync(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var context = tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        if (!context.UserId.HasValue)
        {
            throw new ForbiddenAccessException("Bu islem icin oturum acmaniz gerekir.");
        }

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.UserId == context.UserId.Value, cancellationToken)
            ?? throw new ForbiddenAccessException("Kullanici bulunamadi.");

        var departmentIds = await UserDepartmentAccess.GetAccessibleDepartmentIdsAsync(
            dbContext,
            tenantId,
            user,
            cancellationToken);

        return (user, departmentIds);
    }

    public static void EnsureDepartmentAccess(Guid departmentId, Guid[] accessibleDepartmentIds)
    {
        if (!accessibleDepartmentIds.Contains(departmentId))
        {
            throw new ForbiddenAccessException("Bu birime ait kayitlar uzerinde islem yapamazsiniz.");
        }
    }
}
