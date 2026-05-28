namespace CityCommunicationCenter.Application.Features.Jobs;

internal static class JobWorkflowAuthorization
{
    public static async Task<ApplicationUser> RequireActorAsync(
        IApplicationDbContext dbContext,
        Guid? actorUserId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici dogrulanamadi.");
        }

        var actor = await dbContext.Users.FirstOrDefaultAsync(
            u => u.UserId == actorUserId.Value && u.TenantId == tenantId,
            cancellationToken);
        if (actor is null || !actor.IsActive)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici bulunamadi veya aktif degil.");
        }
        return actor;
    }

    public static bool IsSystemAdmin(ApplicationUser actor) => actor.RoleCode == RoleCode.SystemAdmin;

    public static async Task<bool> ManagesDepartmentAsync(
        IApplicationDbContext dbContext,
        ApplicationUser actor,
        Guid departmentId,
        CancellationToken cancellationToken)
    {
        if (actor.RoleCode != RoleCode.Manager) return false;
        // Aktörün birincil birimi eşleşiyorsa yönetici sayılır
        if (actor.DepartmentId == departmentId) return true;
        var dept = await dbContext.Departments.FirstOrDefaultAsync(
            d => d.DepartmentId == departmentId && d.TenantId == actor.TenantId,
            cancellationToken);
        return dept?.ManagerUserId == actor.UserId || dept?.DeputyManagerUserId == actor.UserId;
    }

    public static async Task EnsureManagesDepartmentAsync(
        IApplicationDbContext dbContext,
        ApplicationUser actor,
        Guid departmentId,
        string errorMessage,
        CancellationToken cancellationToken)
    {
        if (IsSystemAdmin(actor)) return;
        if (await ManagesDepartmentAsync(dbContext, actor, departmentId, cancellationToken)) return;
        throw new ForbiddenAccessException(errorMessage);
    }
}
