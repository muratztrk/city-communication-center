using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals;

/// <summary>
/// Vatandaşa Gönderilecek Mesaj Onayı ekranı için ortak erişim kuralları — Manager (sahip/hedef birim)
/// ve CitizenRequestManager (hedef birimde çalışabildiği vatandaş talepleri) ile SystemAdmin (card #2039).
/// </summary>
internal static class CitizenMessageApprovalAccess
{
    public static bool CanAccessPage(ApplicationUser actor, bool smsDeliveryMode = false) =>
        smsDeliveryMode
            // Sms Onayı: Operator / CRM / SystemAdmin — Manager varsayılan yok (#6a6b6c8e).
            ? actor.RoleCode == RoleCode.SystemAdmin
              || UserRoleAccess.IsCitizenRequestManager(actor)
              || actor.RoleCode == RoleCode.Operator
            : actor.RoleCode == RoleCode.SystemAdmin
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

        // Sms Gönderim Onayı: Operator yalnız çağrı (Phone) VT'lerine erişir (#2112).
        if (actor.RoleCode == RoleCode.Operator)
        {
            return await dbContext.SocialMessages.AsNoTracking().AnyAsync(
                m => m.TenantId == tenantId
                    && m.CitizenRequestNumber != null
                    && m.Channel == SocialChannel.Phone
                    && (m.JobId == job.JobId
                        || (job.SourceRefId.HasValue && m.SocialMessageId == job.SourceRefId.Value)),
                cancellationToken);
        }

        return false;
    }

    /// <summary>
    /// Liste ile aynı uygunluk: Completed/Cancelled + WA/Çağrı VT bağı.
    /// RequestType Citizen olmak zorunda değil — modal ExternalUnit yaratıyor (#2063/#2066).
    /// </summary>
    public static async Task<Job?> FindEligibleTerminalJobAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        bool track,
        CancellationToken cancellationToken)
    {
        var query = track ? dbContext.Jobs : dbContext.Jobs.AsNoTracking();
        var job = await query.FirstOrDefaultAsync(
            j => j.JobId == jobId
                && j.TenantId == tenantId
                && (j.Status == JobStatus.Completed || j.Status == JobStatus.Cancelled),
            cancellationToken);
        if (job is null)
        {
            return null;
        }

        var hasCitizenRequestLink = await dbContext.SocialMessages.AsNoTracking().AnyAsync(
            m => m.TenantId == tenantId
                && m.CitizenRequestNumber != null
                && (m.Channel == SocialChannel.WhatsApp || m.Channel == SocialChannel.Phone)
                && (m.JobId == job.JobId
                    || (job.SourceRefId.HasValue && m.SocialMessageId == job.SourceRefId.Value)),
            cancellationToken);

        return hasCitizenRequestLink ? job : null;
    }
}
