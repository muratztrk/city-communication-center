namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record GetJobsQuery(string? Scope) : IQuery<IReadOnlyList<JobSummaryResponse>>;

public sealed class GetJobsQueryHandler : IRequestHandler<GetJobsQuery, IReadOnlyList<JobSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetJobsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<IReadOnlyList<JobSummaryResponse>> Handle(GetJobsQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;
        var userId = context.UserId;

        var scope = (request.Scope ?? "all").Trim().ToLowerInvariant();
        var actor = userId.HasValue
            ? await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId.Value, cancellationToken)
            : null;

        IQueryable<Job> q = _dbContext.Jobs.AsNoTracking();

        if (scope == "mine" && userId.HasValue)
        {
            q = q.Where(j => j.CreatedByUserId == userId);
        }
        else if (scope == "my-department" && actor is not null)
        {
            q = q.Where(j =>
                j.OwnerDepartmentId == actor.DepartmentId ||
                _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId && jd.DepartmentId == actor.DepartmentId));
        }
        else if (scope == "active")
        {
            q = q.Where(j => j.Status == JobStatus.Active);
        }

        var rows = await (
            from j in q
            join d in _dbContext.Departments.AsNoTracking() on j.OwnerDepartmentId equals d.DepartmentId into dd
            from d in dd.DefaultIfEmpty()
            orderby j.CreatedAtUtc descending
            select new
            {
                Job = j,
                OwnerName = d != null ? d.Name : null,
            }).ToListAsync(cancellationToken);

        var jobIds = rows.Select(r => r.Job.JobId).ToArray();
        var counts = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => jobIds.Contains(t.JobId))
            .GroupBy(t => t.JobId)
            .Select(g => new { JobId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var countsMap = counts.ToDictionary(x => x.JobId, x => x.Count);

        return rows.Select(r => new JobSummaryResponse(
            r.Job.JobId,
            r.Job.TenantId,
            r.Job.Title,
            r.Job.Status.ToString(),
            r.Job.Priority,
            r.Job.OwnerDepartmentId,
            r.OwnerName,
            r.Job.StartDateUtc,
            r.Job.DueDateUtc,
            r.Job.CompletedAtUtc,
            r.Job.CompletionPercentage,
            r.Job.IsCoordinated,
            r.Job.SourceType.ToString(),
            countsMap.GetValueOrDefault(r.Job.JobId, 0))).ToArray();
    }
}

public sealed record GetJobByIdQuery(Guid JobId) : IQuery<JobDetailResponse?>;

public sealed class GetJobByIdQueryHandler : IRequestHandler<GetJobByIdQuery, JobDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetJobByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<JobDetailResponse?> Handle(GetJobByIdQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;
        var job = await _dbContext.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobId == request.JobId, cancellationToken);
        if (job is null) return null;

        var ownerName = await _dbContext.Departments.AsNoTracking()
            .Where(d => d.DepartmentId == job.OwnerDepartmentId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var createdByName = job.CreatedByUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == job.CreatedByUserId.Value)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var depts = await (
            from jd in _dbContext.JobDepartments.AsNoTracking().Where(e => e.JobId == job.JobId)
            join d in _dbContext.Departments.AsNoTracking() on jd.DepartmentId equals d.DepartmentId into dd
            from d in dd.DefaultIfEmpty()
            select new JobDepartmentResponse(
                jd.JobDepartmentId,
                jd.DepartmentId,
                d != null ? d.Name : null,
                jd.Role.ToString(),
                jd.ApprovalStatus.ToString(),
                jd.RequestedByUserId,
                jd.ApprovedByUserId,
                jd.RequestedAtUtc,
                jd.DecidedAtUtc,
                jd.RejectReason,
                jd.Notes)).ToListAsync(cancellationToken);

        var tasks = await (
            from t in _dbContext.Tasks.AsNoTracking().Where(e => e.JobId == job.JobId)
            join dep in _dbContext.Departments.AsNoTracking() on t.AssignedDepartmentId equals dep.DepartmentId into dd
            from dep in dd.DefaultIfEmpty()
            join u in _dbContext.Users.AsNoTracking() on t.AssignedUserId equals u.UserId into uu
            from u in uu.DefaultIfEmpty()
            join cu in _dbContext.Users.AsNoTracking() on t.CreatedByUserId equals cu.UserId into cuu
            from cu in cuu.DefaultIfEmpty()
            join ou in _dbContext.Users.AsNoTracking() on t.OwnerUserId equals ou.UserId into ouu
            from ou in ouu.DefaultIfEmpty()
            select new TaskSummaryResponse(
                t.TaskId, t.TenantId, t.JobId, job.Title,
                t.Title, t.Priority, t.CurrentStatus.ToString(),
                t.AssignedDepartmentId, dep != null ? dep.Name : null,
                t.AssignedUserId, u != null ? u.DisplayName : null,
                t.DueDateUtc, t.CompletionPercentage, t.EstimatedHours, t.ActualHours,
                cu != null ? cu.DisplayName : null, t.CreatedAtUtc,
                ou != null ? ou.DisplayName : null))
            .ToListAsync(cancellationToken);

        var approvals = await _dbContext.Approvals.AsNoTracking()
            .Where(a => a.SubjectType == ApprovalSubjectType.Job && a.SubjectId == job.JobId)
            .OrderBy(a => a.StepOrder)
            .Select(a => new ApprovalStepResponse(
                a.ApprovalId, a.SubjectType.ToString(), a.SubjectId,
                a.ApproverUserId, a.StepOrder, a.Decision.ToString(),
                a.DecisionDateUtc, a.Comment))
            .ToListAsync(cancellationToken);

        return new JobDetailResponse(
            job.JobId, job.TenantId, job.Title, job.Description,
            job.Status.ToString(), job.Priority,
            job.OwnerDepartmentId, ownerName,
            job.StartDateUtc, job.DueDateUtc, job.CompletedAtUtc,
            job.CompletionPercentage, job.IsCoordinated,
            job.SourceType.ToString(), job.SourceRefId, job.CancelReason,
            createdByName, job.CreatedAtUtc,
            depts, tasks, approvals);
    }
}
