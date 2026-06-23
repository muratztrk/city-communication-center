using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>Builds the manager dashboard's status-based task and request summaries.</summary>
public sealed record GetDashboardStatusChartsQuery(DateTimeOffset? FromUtc, DateTimeOffset? ToUtc)
    : IQuery<DashboardStatusChartsResponse>;

public sealed class GetDashboardStatusChartsQueryHandler
    : IQueryHandler<GetDashboardStatusChartsQuery, DashboardStatusChartsResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardStatusChartsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DashboardStatusChartsResponse> Handle(
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        if (context.RoleCode is not ("Manager" or "SystemAdmin") || !context.UserId.HasValue)
        {
            return new DashboardStatusChartsResponse([]);
        }

        var actor = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(
            user => user.TenantId == tenantId && user.UserId == context.UserId.Value && user.IsActive,
            cancellationToken);
        var departmentIds = actor is null
            ? []
            : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                _dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);
        if (departmentIds.Length == 0)
        {
            return new DashboardStatusChartsResponse([]);
        }

        var now = DateTimeOffset.UtcNow;
        var tasks = await _dbContext.Tasks.AsNoTracking()
            .Where(task => task.TenantId == tenantId
                && task.AssignedDepartmentId.HasValue
                && departmentIds.Contains(task.AssignedDepartmentId.Value)
                && (!request.FromUtc.HasValue || task.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || task.CreatedAtUtc <= request.ToUtc.Value))
            .Select(task => new TaskStatusItem(task.AssignedUserId, task.CurrentStatus, task.DueDateUtc))
            .ToListAsync(cancellationToken);

        var outgoingJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.RequestType == JobRequestType.ExternalUnit
            && departmentIds.Contains(job.OwnerDepartmentId)
            && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
            && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value)), cancellationToken);
        var incomingJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && (departmentIds.Contains(job.OwnerDepartmentId)
                || _dbContext.JobDepartments.Any(department => department.JobId == job.JobId
                    && department.Role == JobDepartmentRole.Target
                    && departmentIds.Contains(department.DepartmentId)))
            && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
            && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value)), cancellationToken);
        var myExternalJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.RequestType == JobRequestType.ExternalUnit
            && job.CreatedByUserId == context.UserId.Value
            && (!request.FromUtc.HasValue || job.CreatedAtUtc >= request.FromUtc.Value)
            && (!request.ToUtc.HasValue || job.CreatedAtUtc <= request.ToUtc.Value)), cancellationToken);

        var staffTasksChart = await BuildStaffTasksChartAsync(tasks, tenantId, cancellationToken);
        var charts = new[]
        {
            staffTasksChart,
            BuildTaskChart("dashboard.charts.departmentTasks", tasks, now),
            BuildTaskChart("dashboard.charts.myTasks", tasks.Where(task => task.AssignedUserId == context.UserId.Value), now),
            BuildJobChart("dashboard.charts.outgoingRequests", outgoingJobs, "dashboard.chart.pending", now),
            BuildJobChart("dashboard.charts.incomingRequests", incomingJobs, "dashboard.chart.pendingApproval", now),
            BuildJobChart("dashboard.charts.myRequests", myExternalJobs, "dashboard.chart.externalPendingApproval", now),
        };

        return new DashboardStatusChartsResponse(charts);

    }

    private async Task<List<JobStatusItem>> ProjectJobs(IQueryable<Job> jobs, CancellationToken cancellationToken)
    {
        return await jobs
            .Select(job => new JobStatusItem(
                job.Status,
                job.DueDateUtc,
                _dbContext.Tasks.Any(task => task.JobId == job.JobId
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected)))
            .ToListAsync(cancellationToken);
    }

    private async Task<DashboardChartResponse> BuildStaffTasksChartAsync(
        IEnumerable<TaskStatusItem> tasks,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var counts = tasks
            .Where(task => task.AssignedUserId.HasValue)
            .GroupBy(task => task.AssignedUserId!.Value)
            .Select(group => new { UserId = group.Key, Count = group.Count() })
            .OrderByDescending(item => item.Count)
            .ToList();
        var userIds = counts.Select(item => item.UserId).ToArray();
        var userNames = await _dbContext.Users.AsNoTracking()
            .Where(user => user.TenantId == tenantId && userIds.Contains(user.UserId))
            .ToDictionaryAsync(user => user.UserId, user => user.DisplayName, cancellationToken);

        return new DashboardChartResponse("dashboard.charts.staffTasks",
            counts.Select((item, index) => new DashboardChartSlice(
                userNames.GetValueOrDefault(item.UserId, "—"),
                item.Count,
                StaffChartColors[index % StaffChartColors.Length]))
                .ToList());
    }

    private static DashboardChartResponse BuildTaskChart(
        string titleKey,
        IEnumerable<TaskStatusItem> tasks,
        DateTimeOffset now)
    {
        var values = tasks.ToList();
        var overdue = values.Count(task => IsOpen(task.Status) && task.DueDateUtc < now);
        var pending = values.Count(task => IsOpen(task.Status) && !(task.DueDateUtc < now));
        return new DashboardChartResponse(titleKey,
        [
            new DashboardChartSlice("dashboard.chart.pending", pending, "warning"),
            new DashboardChartSlice("dashboard.chart.overdue", overdue, "danger"),
            new DashboardChartSlice("dashboard.chart.completed", values.Count(task => task.Status == WorkflowTaskStatus.Completed), "success"),
            new DashboardChartSlice("dashboard.chart.cancelled", values.Count(task => task.Status is WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected), "neutral"),
        ]);
    }

    private static DashboardChartResponse BuildJobChart(
        string titleKey,
        IEnumerable<JobStatusItem> jobs,
        string pendingLabel,
        DateTimeOffset now)
    {
        var values = jobs.ToList();
        var overdue = values.Where(job => IsOpen(job.Status) && job.DueDateUtc < now).ToList();
        var current = values.Except(overdue).ToList();
        return new DashboardChartResponse(titleKey,
        [
            new DashboardChartSlice(pendingLabel, current.Count(job => job.Status is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested), "warning"),
            new DashboardChartSlice("dashboard.chart.overdue", overdue.Count, "danger"),
            new DashboardChartSlice("dashboard.chart.approved", current.Count(job => job.Status == JobStatus.Active && !job.HasOpenTasks), "info"),
            new DashboardChartSlice("dashboard.chart.inProgress", current.Count(job => job.Status == JobStatus.Active && job.HasOpenTasks), "primary"),
            new DashboardChartSlice("dashboard.chart.completed", values.Count(job => job.Status == JobStatus.Completed), "success"),
            new DashboardChartSlice("dashboard.chart.cancelled", values.Count(job => job.Status is JobStatus.Cancelled or JobStatus.Rejected), "neutral"),
        ]);
    }

    private static bool IsOpen(WorkflowTaskStatus status) => status is not (WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected);
    private static bool IsOpen(JobStatus status) => status is not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected);

    private sealed record TaskStatusItem(Guid? AssignedUserId, WorkflowTaskStatus Status, DateTimeOffset? DueDateUtc);
    private sealed record JobStatusItem(JobStatus Status, DateTimeOffset? DueDateUtc, bool HasOpenTasks);

    private static readonly string[] StaffChartColors = ["primary", "success", "info", "warning", "danger", "neutral"];
}
