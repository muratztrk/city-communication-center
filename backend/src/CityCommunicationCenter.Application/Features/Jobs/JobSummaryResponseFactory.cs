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
            job.IsProjectCreatorRequested,
            job.IsProjectOwnerConfirmed,
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
            job.UpdatedAtUtc,
            CitizenTerminalMessageReleasedAtUtc: await ResolveEffectiveReleasedAtAsync(
                dbContext, job, cancellationToken),
            CancelledByRoleCode: (await ResolveCancelledByRoleCodeMapAsync(
                dbContext,
                job.TenantId,
                [job],
                cancellationToken)).GetValueOrDefault(job.JobId));
    }

    static async Task<DateTimeOffset?> ResolveEffectiveReleasedAtAsync(
        IApplicationDbContext dbContext,
        Job job,
        CancellationToken cancellationToken)
    {
        var releasedAtByJobId = new Dictionary<Guid, DateTimeOffset?>
        {
            [job.JobId] = job.CitizenTerminalMessageReleasedAtUtc,
        };
        await Social.ConversationEntryOperatorVisibility.ApplyCitizenMessageApprovalReleasedFallbackAsync(
            dbContext,
            job.TenantId,
            releasedAtByJobId,
            cancellationToken);
        return releasedAtByJobId.GetValueOrDefault(job.JobId);
    }

    internal static async Task<Dictionary<Guid, string?>> ResolveCancelledByRoleCodeMapAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        IReadOnlyCollection<Job> jobs,
        CancellationToken cancellationToken)
    {
        var cancelledJobs = jobs
            .Where(job => job.Status == JobStatus.Cancelled)
            .ToList();
        if (cancelledJobs.Count == 0)
        {
            return [];
        }

        var cancelledEntityIds = cancelledJobs.Select(job => job.JobId.ToString()).ToList();
        var cancelAudits = await dbContext.AuditLogs
            .AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityType == nameof(Job)
                && audit.Action == "JobCancelled"
                && cancelledEntityIds.Contains(audit.EntityId))
            .Select(audit => new { audit.EntityId, audit.ActorUserId, audit.EventTimeUtc })
            .ToListAsync(cancellationToken);

        var actorByJobId = cancelAudits
            .GroupBy(audit => audit.EntityId)
            .ToDictionary(
                group => Guid.Parse(group.Key),
                group => group.OrderByDescending(item => item.EventTimeUtc).First().ActorUserId);

        foreach (var job in cancelledJobs)
        {
            if (!actorByJobId.ContainsKey(job.JobId) && job.UpdatedByUserId.HasValue)
            {
                actorByJobId[job.JobId] = job.UpdatedByUserId;
            }
        }

        var actorIds = actorByJobId.Values
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        if (actorIds.Count == 0)
        {
            return [];
        }

        var roleByUserId = await dbContext.Users
            .AsNoTracking()
            .Where(user => actorIds.Contains(user.UserId))
            .ToDictionaryAsync(user => user.UserId, user => user.RoleCode.ToString(), cancellationToken);

        return actorByJobId
            .Where(pair => pair.Value.HasValue && roleByUserId.ContainsKey(pair.Value.Value))
            .ToDictionary(pair => pair.Key, pair => (string?)roleByUserId[pair.Value!.Value]);
    }
}
