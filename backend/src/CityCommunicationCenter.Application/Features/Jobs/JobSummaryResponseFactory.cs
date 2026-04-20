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

        return new JobSummaryResponse(
            job.JobId,
            job.TenantId,
            job.Title,
            job.Status.ToString(),
            job.Priority,
            job.OwnerDepartmentId,
            ownerName,
            job.StartDateUtc,
            job.DueDateUtc,
            job.CompletedAtUtc,
            job.CompletionPercentage,
            job.IsCoordinated,
            job.SourceType.ToString(),
            taskCount);
    }
}
