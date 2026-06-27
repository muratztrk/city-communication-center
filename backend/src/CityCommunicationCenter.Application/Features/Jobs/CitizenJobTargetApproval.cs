namespace CityCommunicationCenter.Application.Features.Jobs;

internal static class CitizenJobTargetApproval
{
    internal static async Task TryRecordTargetApprovalAsync(
        IApplicationDbContext dbContext,
        Job job,
        Guid? assignedDepartmentId,
        Guid actorUserId,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        if (assignedDepartmentId is null)
        {
            return;
        }

        var isCitizenRequest = job.RequestType == JobRequestType.Citizen
            || job.SourceType is JobSourceType.SocialMessage or JobSourceType.CitizenRequest;
        if (!isCitizenRequest)
        {
            return;
        }

        var targetDepartment = await dbContext.JobDepartments.FirstOrDefaultAsync(
            entity => entity.JobId == job.JobId
                && entity.DepartmentId == assignedDepartmentId.Value
                && entity.Role == JobDepartmentRole.Target
                && entity.ApprovalStatus == JobApprovalStatus.Pending,
            cancellationToken);
        if (targetDepartment is null)
        {
            return;
        }

        targetDepartment.ApprovalStatus = JobApprovalStatus.Approved;
        targetDepartment.ApprovedByUserId = actorUserId;
        targetDepartment.DecidedAtUtc = utcNow;
        targetDepartment.UpdatedAtUtc = utcNow;
        targetDepartment.UpdatedByUserId = actorUserId;
    }
}
