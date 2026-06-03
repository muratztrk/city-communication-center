namespace CityCommunicationCenter.Application.Features.Jobs;

internal static class JobSummaryResponseFactory
{
    public static async Task<JobSummaryResponse> CreateAsync(
        IApplicationDbContext dbContext,
        Job job,
        CancellationToken cancellationToken)
    {
        var ownerName = await dbContext.Departments
            .Where(d => d.DepartmentId == job.OwnerDepartmentId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync(cancellationToken);
        var taskCount = await dbContext.Tasks.CountAsync(t => t.JobId == job.JobId, cancellationToken);
        var createdByDisplayName = job.CreatedByUserId.HasValue
            ? await dbContext.Users
                .Where(u => u.UserId == job.CreatedByUserId.Value)
                .Select(u => (string?)u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;
        var departments = await dbContext.JobDepartments
            .AsNoTracking()
            .Where(jd => jd.JobId == job.JobId)
            .Select(jd => new JobDepartmentResponse(
                jd.JobDepartmentId,
                jd.DepartmentId,
                dbContext.Departments
                    .AsNoTracking()
                    .Where(d => d.DepartmentId == jd.DepartmentId)
                    .Select(d => (string?)d.Name)
                    .FirstOrDefault(),
                jd.Role.ToString(),
                jd.ApprovalStatus.ToString(),
                jd.RequestedByUserId,
                jd.ApprovedByUserId,
                jd.ApprovedByUserId.HasValue
                    ? dbContext.Users
                        .AsNoTracking()
                        .Where(u => u.UserId == jd.ApprovedByUserId.Value)
                        .Select(u => (string?)u.DisplayName)
                        .FirstOrDefault()
                    : null,
                jd.RequestedAtUtc,
                jd.DecidedAtUtc,
                jd.RejectReason,
                jd.Notes))
            .ToListAsync(cancellationToken);

        return new JobSummaryResponse(
            job.JobId,
            job.TenantId,
            job.Title,
            job.Status.ToString(),
            job.Priority,
            job.RequestType.ToString(),
            job.IsProject,
            job.CitizenName,
            job.CitizenPhone,
            job.OwnerDepartmentId,
            ownerName,
            job.StartDateUtc,
            job.DueDateUtc,
            job.CompletedAtUtc,
            job.CompletionPercentage,
            job.IsCoordinated,
            job.SourceType.ToString(),
            taskCount,
            departments,
            job.CreatedAtUtc,
            job.JobNumber,
            job.JobNumberYear,
            createdByDisplayName,
            job.UpdatedAtUtc);
    }
}
