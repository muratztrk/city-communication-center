using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı ekranı için ortak erişim kuralları — Manager (sahip/hedef birim)
/// ve CitizenRequestManager (hedef birimde çalışabildiği vatandaş talepleri) ile SystemAdmin (card #2039).
/// </summary>
internal static class CitizenMessageApprovalAccess
{
    public static bool CanAccessPage(ApplicationUser actor) =>
        actor.RoleCode == RoleCode.SystemAdmin
        || actor.RoleCode == RoleCode.Manager
        || UserRoleAccess.IsCitizenRequestManager(actor);

    public static async Task<Guid[]?> GetVisibleDepartmentIdsForManagerAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser actor,
        Guid? activeDepartmentId,
        CancellationToken cancellationToken)
    {
        if (actor.RoleCode != RoleCode.Manager)
        {
            return null;
        }

        return await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
            dbContext, tenantId, actor, activeDepartmentId, cancellationToken);
    }

    public static async Task<bool> CanAccessJobAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        ApplicationUser actor,
        Job job,
        Guid? activeDepartmentId,
        CancellationToken cancellationToken)
    {
        if (actor.RoleCode == RoleCode.SystemAdmin)
        {
            return true;
        }

        if (actor.RoleCode == RoleCode.Manager)
        {
            var visibleDepartmentIds = await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                dbContext, tenantId, actor, activeDepartmentId, cancellationToken);
            if (visibleDepartmentIds.Contains(job.OwnerDepartmentId))
            {
                return true;
            }

            return await dbContext.JobDepartments.AsNoTracking().AnyAsync(
                jd => jd.JobId == job.JobId && visibleDepartmentIds.Contains(jd.DepartmentId),
                cancellationToken);
        }

        if (UserRoleAccess.IsCitizenRequestManager(actor))
        {
            return await UserRoleAccess.CanManageCitizenRequestAsync(dbContext, tenantId, actor, job, cancellationToken);
        }

        return false;
    }
}
