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
        // gerçek karar bilgisi (onaycı/tarih) ilk personel atamasında yazılır — eski kayıtlardaki
        // oluşturan-damgalı satırlar da gerçek onaycıya güncellenir (card #1333).
        var targetDepartment = await dbContext.JobDepartments.FirstOrDefaultAsync(
            entity => entity.JobId == job.JobId
                && entity.DepartmentId == assignedDepartmentId.Value
                && entity.Role == JobDepartmentRole.Target
                && (entity.ApprovalStatus == JobApprovalStatus.Pending
                    || (entity.ApprovalStatus == JobApprovalStatus.Approved
                        && (entity.DecidedAtUtc == null || entity.ApprovedByUserId == job.CreatedByUserId))),
            cancellationToken);
        if (targetDepartment is null)
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
