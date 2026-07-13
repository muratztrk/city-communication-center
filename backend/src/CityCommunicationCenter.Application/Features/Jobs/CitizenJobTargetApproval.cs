namespace CityCommunicationCenter.Application.Features.Jobs;

internal static class CitizenJobTargetApproval
{
    internal static async Task<bool> TryRecordTargetApprovalAsync(
        IApplicationDbContext dbContext,
        Job job,
        Guid? assignedDepartmentId,
        Guid actorUserId,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        if (assignedDepartmentId is null)
        {
            return false;
        }

        var isCitizenRequest = JobCitizenRequestHelper.IsCitizenRequest(job);
        var isExternalRequest = job.RequestType == JobRequestType.ExternalUnit;
        if (!isCitizenRequest && !isExternalRequest)
        {
            return false;
        }

        // Vatandaş talebinde Pending hedef onaylanır; birim dışı talepte otomatik-Approved hedefte
        // gerçek karar bilgisi ilk görev atamasında hedef yöneticisiyle kesin olarak yenilenir.
        // Böylece sahibi birim yöneticisinin otomatik damgası da oluşturan-damgalı eski kayıtlar
        // gibi gerçek hedef onaycısına çevrilir (cards #1333/#1595).
        var targetDepartment = await dbContext.JobDepartments.FirstOrDefaultAsync(
            entity => entity.JobId == job.JobId
                && entity.DepartmentId == assignedDepartmentId.Value
                && entity.Role == JobDepartmentRole.Target
                && (entity.ApprovalStatus == JobApprovalStatus.Pending
                    || entity.ApprovalStatus == JobApprovalStatus.Approved),
            cancellationToken);
        if (targetDepartment is null)
        {
            return false;
        }

        var hasExistingTargetTask = await dbContext.Tasks
            .AsNoTracking()
            .AnyAsync(
                task => task.JobId == job.JobId
                    && task.AssignedDepartmentId == assignedDepartmentId.Value,
                cancellationToken);
        var shouldRefreshAutomaticApproval = targetDepartment.ApprovalStatus == JobApprovalStatus.Approved
            && (!hasExistingTargetTask
                || targetDepartment.DecidedAtUtc == null
                || targetDepartment.ApprovedByUserId == job.CreatedByUserId);
        if (targetDepartment.ApprovalStatus != JobApprovalStatus.Pending && !shouldRefreshAutomaticApproval)
        {
            return false;
        }

        targetDepartment.ApprovalStatus = JobApprovalStatus.Approved;
        targetDepartment.ApprovedByUserId = actorUserId;
        targetDepartment.DecidedAtUtc = utcNow;
        targetDepartment.UpdatedAtUtc = utcNow;
        targetDepartment.UpdatedByUserId = actorUserId;
        return true;
    }
}
