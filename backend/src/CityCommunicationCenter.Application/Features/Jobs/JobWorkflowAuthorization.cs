using CityCommunicationCenter.Application.Features.Departments;
using CityCommunicationCenter.Application.Features.Users;

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

    public static async Task<bool> IsResponsibleForDepartmentAsync(
        IApplicationDbContext dbContext,
        ApplicationUser actor,
        Guid departmentId,
        CancellationToken cancellationToken)
    {
        if (actor.RoleCode != RoleCode.Manager) return false;
        var dept = await dbContext.Departments.AsNoTracking().FirstOrDefaultAsync(
            d => d.DepartmentId == departmentId && d.TenantId == actor.TenantId,
            cancellationToken);
        if (dept is null) return false;
        return DepartmentResponseFactory.ParseResponsibleUserIds(dept.ResponsibleUserIdsJson)
            .Contains(actor.UserId);
    }

    /// <summary>Müdür, vekil müdür veya birim sorumlusu.</summary>
    public static async Task<bool> CanManageJobAsDepartmentLeaderAsync(
        IApplicationDbContext dbContext,
        ApplicationUser actor,
        Guid departmentId,
        CancellationToken cancellationToken)
    {
        if (IsSystemAdmin(actor)) return true;
        if (await ManagesDepartmentAsync(dbContext, actor, departmentId, cancellationToken)) return true;
        return await IsResponsibleForDepartmentAsync(dbContext, actor, departmentId, cancellationToken);
    }

    public static async Task EnsureCanEditJobAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser actor,
        Job job,
        CancellationToken cancellationToken)
    {
        if (IsSystemAdmin(actor)) return;
        if (job.CreatedByUserId == actor.UserId) return;

        if (await CanManageJobAsDepartmentLeaderAsync(
                dbContext, actor, job.OwnerDepartmentId, cancellationToken))
        {
            return;
        }

        var targetDepartmentIds = await dbContext.JobDepartments.AsNoTracking()
            .Where(jd => jd.JobId == job.JobId
                && jd.TenantId == tenantId
                && jd.Role == JobDepartmentRole.Target)
            .Select(jd => jd.DepartmentId)
            .ToListAsync(cancellationToken);

        foreach (var targetDepartmentId in targetDepartmentIds)
        {
            if (await CanManageJobAsDepartmentLeaderAsync(
                    dbContext, actor, targetDepartmentId, cancellationToken))
            {
                return;
            }

            if (await UserRoleAccess.CanManageCitizenRequestInTargetDepartmentAsync(
                    dbContext,
                    tenantId,
                    actor,
                    job,
                    targetDepartmentId,
                    cancellationToken))
            {
                return;
            }
        }

        throw new ForbiddenAccessException("Bu isi duzenleme yetkiniz yok.");
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

    public static async Task EnsureManagesDepartmentOrCitizenRequestManagerAsync(
        IApplicationDbContext dbContext,
        ApplicationUser actor,
        Job job,
        Guid departmentId,
        string errorMessage,
        CancellationToken cancellationToken)
    {
        if (IsSystemAdmin(actor)) return;
        if (await ManagesDepartmentAsync(dbContext, actor, departmentId, cancellationToken)) return;
        if (await UserRoleAccess.CanManageCitizenRequestInTargetDepartmentAsync(
                dbContext,
                actor.TenantId,
                actor,
                job,
                departmentId,
                cancellationToken))
        {
            return;
        }

        throw new ForbiddenAccessException(errorMessage);
    }
}
