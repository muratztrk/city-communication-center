namespace CityCommunicationCenter.Application.Features.Jobs;

public sealed record GetJobsQuery(string? Scope) : IQuery<IReadOnlyList<JobSummaryResponse>>;

public sealed class GetJobsQueryHandler : IQueryHandler<GetJobsQuery, IReadOnlyList<JobSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetJobsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<JobSummaryResponse>> Handle(GetJobsQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;

        var scope = (request.Scope ?? "all").Trim().ToLowerInvariant();
        var actor = userId.HasValue
            ? await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId.Value, cancellationToken)
            : null;

        IQueryable<Job> q = _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId);

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

        var rows = await q
            .OrderByDescending(j => j.CreatedAtUtc)
            .Select(j => new
            {
                Job = j,
                OwnerName = _dbContext.Departments
                    .AsNoTracking()
                    .Where(d => d.DepartmentId == j.OwnerDepartmentId)
                    .Select(d => (string?)d.Name)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        var jobIds = rows.Select(r => r.Job.JobId).ToArray();
        var counts = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => jobIds.Contains(t.JobId))
            .GroupBy(t => t.JobId)
            .Select(g => new { JobId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var countsMap = counts.ToDictionary(x => x.JobId, x => x.Count);
        var departments = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(jd => jobIds.Contains(jd.JobId))
            .Select(jd => new
            {
                jd.JobId,
                Department = new JobDepartmentResponse(
                    jd.JobDepartmentId,
                    jd.DepartmentId,
                    _dbContext.Departments
                        .AsNoTracking()
                        .Where(d => d.DepartmentId == jd.DepartmentId)
                        .Select(d => (string?)d.Name)
                        .FirstOrDefault(),
                    jd.Role.ToString(),
                    jd.ApprovalStatus.ToString(),
                    jd.RequestedByUserId,
                    jd.ApprovedByUserId,
                    jd.RequestedAtUtc,
                    jd.DecidedAtUtc,
                    jd.RejectReason,
                    jd.Notes)
            })
            .ToListAsync(cancellationToken);
        var departmentsMap = departments
            .GroupBy(x => x.JobId)
            .ToDictionary(x => x.Key, x => (IReadOnlyCollection<JobDepartmentResponse>)x.Select(d => d.Department).ToArray());

        return rows.Select(r => new JobSummaryResponse(
            r.Job.JobId,
            r.Job.TenantId,
            r.Job.Title,
            r.Job.Status.ToString(),
            r.Job.Priority,
            r.Job.RequestType.ToString(),
            r.Job.IsProject,
            r.Job.CitizenName,
            r.Job.CitizenPhone,
            r.Job.OwnerDepartmentId,
            r.OwnerName,
            r.Job.StartDateUtc,
            r.Job.DueDateUtc,
            r.Job.CompletedAtUtc,
            r.Job.CompletionPercentage,
            r.Job.IsCoordinated,
            r.Job.SourceType.ToString(),
            countsMap.GetValueOrDefault(r.Job.JobId, 0),
            departmentsMap.GetValueOrDefault(r.Job.JobId, Array.Empty<JobDepartmentResponse>()))).ToArray();
    }
}

public sealed record GetJobByIdQuery(Guid JobId) : IQuery<JobDetailResponse?>;

public sealed class GetJobByIdQueryHandler : IQueryHandler<GetJobByIdQuery, JobDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetJobByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<JobDetailResponse?> Handle(GetJobByIdQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var job = await _dbContext.Jobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.JobId == request.JobId && j.TenantId == tenantId, cancellationToken);
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

        var depts = await _dbContext.JobDepartments
            .AsNoTracking()
            .Where(jd => jd.JobId == job.JobId)
            .Select(jd => new JobDepartmentResponse(
                jd.JobDepartmentId,
                jd.DepartmentId,
                _dbContext.Departments
                    .AsNoTracking()
                    .Where(d => d.DepartmentId == jd.DepartmentId)
                    .Select(d => (string?)d.Name)
                    .FirstOrDefault(),
                jd.Role.ToString(),
                jd.ApprovalStatus.ToString(),
                jd.RequestedByUserId,
                jd.ApprovedByUserId,
                jd.RequestedAtUtc,
                jd.DecidedAtUtc,
                jd.RejectReason,
                jd.Notes))
            .ToListAsync(cancellationToken);

        var tasks = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t => t.JobId == job.JobId)
            .Select(t => new TaskSummaryResponse(
                t.TaskId,
                t.TenantId,
                t.JobId,
                job.Title,
                t.Title,
                t.Priority,
                t.CurrentStatus.ToString(),
                t.AssignedDepartmentId,
                _dbContext.Departments
                    .AsNoTracking()
                    .Where(dep => dep.DepartmentId == t.AssignedDepartmentId)
                    .Select(dep => (string?)dep.Name)
                    .FirstOrDefault(),
                t.AssignedUserId,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.AssignedUserId)
                    .Select(u => (string?)u.DisplayName)
                    .FirstOrDefault(),
                t.DueDateUtc,
                t.CompletionPercentage,
                t.EstimatedHours,
                t.ActualHours,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.CreatedByUserId)
                    .Select(u => (string?)u.DisplayName)
                    .FirstOrDefault(),
                t.CreatedAtUtc,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(u => u.UserId == t.OwnerUserId)
                    .Select(u => (string?)u.DisplayName)
                    .FirstOrDefault()))
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
            job.RequestType.ToString(), job.IsProject, job.CitizenName, job.CitizenPhone,
            job.OwnerDepartmentId, ownerName,
            job.StartDateUtc, job.DueDateUtc, job.CompletedAtUtc,
            job.CompletionPercentage, job.IsCoordinated,
            job.SourceType.ToString(), job.SourceRefId, job.CancelReason,
            createdByName, job.CreatedAtUtc,
            depts, tasks, approvals);
    }
}
