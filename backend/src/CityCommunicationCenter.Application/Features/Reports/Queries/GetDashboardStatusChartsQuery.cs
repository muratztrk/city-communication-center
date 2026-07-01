using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

/// <summary>Builds the manager dashboard's status-based task and request summaries.</summary>
public enum TaskDashboardFilter { All, Assigned, Routine }

public sealed record GetDashboardStatusChartsQuery(
    DateTimeOffset? FromUtc,
    DateTimeOffset? ToUtc,
    TaskDashboardFilter StaffTaskType = TaskDashboardFilter.All,
    TaskDashboardFilter DepartmentTaskType = TaskDashboardFilter.All,
    TaskDashboardFilter MyTaskType = TaskDashboardFilter.All)
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
        if (!context.UserId.HasValue)
        {
            return new DashboardStatusChartsResponse([]);
        }

        if (context.RoleCode is not ("Manager" or "SystemAdmin"))
        {
            return await BuildStandardUserChartsAsync(
                tenantId,
                context.UserId.Value,
                context.RoleCode,
                context.ActiveDepartmentId,
                request,
                cancellationToken);
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
                && (MatchesCreatedPeriod(task.CreatedAtUtc, request.FromUtc, request.ToUtc)
                    || IsOpenOverdueTask(task.CurrentStatus, task.DueDateUtc, now)))
            .Select(task => new TaskStatusItem(task.AssignedUserId, task.CurrentStatus, task.DueDateUtc, task.Job.SourceType))
            .ToListAsync(cancellationToken);

        var outgoingJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.RequestType == JobRequestType.ExternalUnit
            && departmentIds.Contains(job.OwnerDepartmentId)
            && (MatchesCreatedPeriod(job.CreatedAtUtc, request.FromUtc, request.ToUtc)
                || IsOpenOverdueJob(job.Status, job.DueDateUtc, now))), cancellationToken);
        var incomingJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && (departmentIds.Contains(job.OwnerDepartmentId)
                || _dbContext.JobDepartments.Any(department => department.JobId == job.JobId
                    && department.Role == JobDepartmentRole.Target
                    && departmentIds.Contains(department.DepartmentId)))
            && (MatchesCreatedPeriod(job.CreatedAtUtc, request.FromUtc, request.ToUtc)
                || IsOpenOverdueJob(job.Status, job.DueDateUtc, now))), cancellationToken);
        var myExternalJobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.RequestType == JobRequestType.ExternalUnit
            && job.CreatedByUserId == context.UserId.Value
            && (MatchesCreatedPeriod(job.CreatedAtUtc, request.FromUtc, request.ToUtc)
                || IsOpenOverdueJob(job.Status, job.DueDateUtc, now))), cancellationToken);

        var staffUserIds = await UserDepartmentAccess.GetStaffUserIdsForDepartmentsAsync(
            _dbContext,
            tenantId,
            departmentIds,
            cancellationToken);
        var staffTasks = FilterTasks(tasks, request.StaffTaskType)
            .Where(task => task.AssignedUserId.HasValue && staffUserIds.Contains(task.AssignedUserId.Value));
        var staffTasksChart = await BuildStaffTasksChartAsync(staffTasks, tenantId, cancellationToken);
        var charts = new[]
        {
            staffTasksChart,
            BuildTaskChart("dashboard.charts.departmentTasks", FilterTasks(tasks, request.DepartmentTaskType), now),
            BuildTaskChart("dashboard.charts.myTasks", FilterTasks(tasks.Where(task => task.AssignedUserId == context.UserId.Value), request.MyTaskType), now),
            BuildJobChart("dashboard.charts.outgoingRequests", outgoingJobs, "dashboard.chart.pending", now, true),
            BuildJobChart("dashboard.charts.incomingRequests", incomingJobs, "dashboard.chart.pendingApproval", now, true),
            BuildJobChart("dashboard.charts.myRequests", myExternalJobs, "dashboard.chart.externalPendingApproval", now, true),
        };

        return new DashboardStatusChartsResponse(charts);

    }

    private async Task<List<CitizenJobStatusItem>> ProjectCitizenJobs(IQueryable<Job> jobs, CancellationToken cancellationToken)
    {
        return await jobs
            .Select(job => new CitizenJobStatusItem(
                job.Status,
                job.DueDateUtc,
                _dbContext.Tasks.Count(task => task.JobId == job.JobId)))
            .ToListAsync(cancellationToken);
    }

    private static DashboardChartResponse BuildCitizenRequestsChart(
        IEnumerable<CitizenJobStatusItem> jobs,
        DateTimeOffset now)
    {
        var values = jobs.ToList();
        var processingReceived = 0;
        var overdue = 0;
        var inProgress = 0;
        var completed = 0;
        var cancelled = 0;

        foreach (var job in values)
        {
            switch (ClassifyCitizenJobStatus(job, now))
            {
                case CitizenJobDisplayStatus.Completed:
                    completed++;
                    break;
                case CitizenJobDisplayStatus.Cancelled:
                    cancelled++;
                    break;
                case CitizenJobDisplayStatus.Overdue:
                    overdue++;
                    break;
                case CitizenJobDisplayStatus.InProgress:
                    inProgress++;
                    break;
                default:
                    processingReceived++;
                    break;
            }
        }

        return new DashboardChartResponse("dashboard.charts.citizenRequests",
        [
            new DashboardChartSlice("dashboard.chart.citizenProcessingReceived", processingReceived, "info"),
            new DashboardChartSlice("dashboard.chart.overdue", overdue, "orange"),
            new DashboardChartSlice("dashboard.chart.inProgress", inProgress, "success"),
            new DashboardChartSlice("dashboard.chart.completed", completed, "primary"),
            new DashboardChartSlice("dashboard.chart.cancelled", cancelled, "danger"),
        ]);
    }

    private static CitizenJobDisplayStatus ClassifyCitizenJobStatus(CitizenJobStatusItem job, DateTimeOffset now)
    {
        if (job.Status == JobStatus.Completed)
        {
            return CitizenJobDisplayStatus.Completed;
        }

        if (job.Status is JobStatus.Cancelled or JobStatus.Rejected or JobStatus.RevisionRequested)
        {
            return CitizenJobDisplayStatus.Cancelled;
        }

        if (job.DueDateUtc.HasValue && IsPastDue(job.DueDateUtc, now))
        {
            return CitizenJobDisplayStatus.Overdue;
        }

        if (job.Status == JobStatus.Active && job.TaskCount > 0)
        {
            return CitizenJobDisplayStatus.InProgress;
        }

        return CitizenJobDisplayStatus.ProcessingReceived;
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

    private async Task<DashboardStatusChartsResponse> BuildStandardUserChartsAsync(
        Guid tenantId,
        Guid userId,
        string? roleCode,
        Guid? activeDepartmentId,
        GetDashboardStatusChartsQuery request,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var tasks = await _dbContext.Tasks.AsNoTracking()
            .Where(task => task.TenantId == tenantId
                && task.AssignedUserId == userId
                && (MatchesCreatedPeriod(task.CreatedAtUtc, request.FromUtc, request.ToUtc)
                    || IsOpenOverdueTask(task.CurrentStatus, task.DueDateUtc, now)))
            .Select(task => new TaskStatusItem(task.AssignedUserId, task.CurrentStatus, task.DueDateUtc, task.Job.SourceType))
            .ToListAsync(cancellationToken);
        var actor = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(
            user => user.TenantId == tenantId && user.UserId == userId && user.IsActive,
            cancellationToken);
        var departmentIds = actor is null
            ? []
            : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                _dbContext, tenantId, actor, activeDepartmentId, cancellationToken, includeManagedDepartments: false);
        // "Birimdeki Görevler" 2 dilimli grafiği görev tipine göre filtrelenir (card 762).
        var departmentTasksQuery = _dbContext.Tasks.Where(task => task.TenantId == tenantId
            && task.AssignedDepartmentId.HasValue
            && departmentIds.Contains(task.AssignedDepartmentId.Value)
            && (!request.FromUtc.HasValue || task.CreatedAtUtc >= request.FromUtc.Value)
            && (!request.ToUtc.HasValue || task.CreatedAtUtc <= request.ToUtc.Value));
        departmentTasksQuery = request.DepartmentTaskType switch
        {
            TaskDashboardFilter.Assigned => departmentTasksQuery.Where(task => task.Job.SourceType != JobSourceType.Routine),
            TaskDashboardFilter.Routine => departmentTasksQuery.Where(task => task.Job.SourceType == JobSourceType.Routine),
            _ => departmentTasksQuery,
        };
        departmentTasksQuery = departmentTasksQuery.Where(task =>
            task.CurrentStatus != WorkflowTaskStatus.Cancelled
            && task.CurrentStatus != WorkflowTaskStatus.Rejected);
        var ownDepartmentTaskCount = departmentIds.Length == 0
            ? 0
            : await departmentTasksQuery.CountAsync(task => task.AssignedUserId == userId, cancellationToken);
        // Pie dilimleri birbirini dışlamalıdır: "Benim Görevlerim" birim toplamının
        // içinde tekrar sayılırsa grafik toplamı griddeki kayıt sayısını aşar.
        var departmentOtherTaskCount = departmentIds.Length == 0
            ? 0
            : await departmentTasksQuery.CountAsync(task => task.AssignedUserId != userId, cancellationToken);
        var jobs = await ProjectJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
            job.TenantId == tenantId
            && job.CreatedByUserId == userId
            && (MatchesCreatedPeriod(job.CreatedAtUtc, request.FromUtc, request.ToUtc)
                || IsOpenOverdueJob(job.Status, job.DueDateUtc, now))), cancellationToken);

        var charts = new List<DashboardChartResponse>
        {
            // "Görevlerim" grafiği görev tipine göre filtrelenir (card 762).
            BuildTaskChart("dashboard.charts.myTasks", FilterTasks(tasks, request.MyTaskType), now),
            BuildJobChart("dashboard.charts.myRequests", jobs, "dashboard.chart.pending", now, false),
            new DashboardChartResponse("dashboard.charts.departmentTasks",
            [
                new DashboardChartSlice("dashboard.chart.assignedToMe", ownDepartmentTaskCount, "primary"),
                new DashboardChartSlice("dashboard.chart.departmentTotal", departmentOtherTaskCount, "info"),
            ]),
        };

        if (roleCode is "Reporter" or "Operator")
        {
            var citizenJobs = await ProjectCitizenJobs(_dbContext.Jobs.AsNoTracking().Where(job =>
                job.TenantId == tenantId
                && job.RequestType == JobRequestType.Citizen
                && (MatchesCreatedPeriod(job.CreatedAtUtc, request.FromUtc, request.ToUtc)
                    || IsOpenOverdueJob(job.Status, job.DueDateUtc, now))), cancellationToken);
            charts.Add(BuildCitizenRequestsChart(citizenJobs, now));
        }

        return new DashboardStatusChartsResponse(charts);
    }

    private async Task<DashboardChartResponse> BuildStaffTasksChartAsync(
        IEnumerable<TaskStatusItem> tasks,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var counts = tasks
            .Where(task => task.AssignedUserId.HasValue
                && task.Status is not (WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected))
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
                $"{item.UserId}|{userNames.GetValueOrDefault(item.UserId, "—")}",
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
        var overdue = values.Count(task => IsActionableOpen(task.Status) && IsPastDue(task.DueDateUtc, now));
        var pending = values.Count(task => IsActionableOpen(task.Status) && !IsPastDue(task.DueDateUtc, now));
        return new DashboardChartResponse(titleKey,
        [
            new DashboardChartSlice("dashboard.chart.pending", pending, "warning"),
            new DashboardChartSlice("dashboard.chart.overdue", overdue, "orange"),
            new DashboardChartSlice("dashboard.chart.completed", values.Count(task => task.Status == WorkflowTaskStatus.Completed), "primary"),
            new DashboardChartSlice("dashboard.chart.cancelled", values.Count(task => task.Status is WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected), "danger"),
        ]);
    }

    private static DashboardChartResponse BuildJobChart(
        string titleKey,
        IEnumerable<JobStatusItem> jobs,
        string pendingLabel,
        DateTimeOffset now,
        bool includeInProgress)
    {
        var values = jobs.ToList();
        var pending = values.Count(job => MatchesJobPendingSlice(job.Status, pendingLabel) && !IsPastDue(job.DueDateUtc, now));
        // Son tarihi geçmiş kayıtlar yalnızca DueDateUtc ile belirlenir (card #1181).
        var overdue = values.Count(job => IsOpen(job.Status) && IsPastDue(job.DueDateUtc, now));
        var activeNotOverdue = values.Where(job =>
            job.Status == JobStatus.Active
            && !IsPastDue(job.DueDateUtc, now)).ToList();
        var slices = new List<DashboardChartSlice>
        {
            new(pendingLabel, pending, "warning"),
            new("dashboard.chart.overdue", overdue, "orange"),
            new("dashboard.chart.approved", includeInProgress ? activeNotOverdue.Count(job => !job.HasOpenTasks) : activeNotOverdue.Count, "info"),
        };
        if (includeInProgress)
        {
            slices.Add(new DashboardChartSlice("dashboard.chart.inProgress", activeNotOverdue.Count(job => job.HasOpenTasks), "success"));
        }
        slices.Add(new DashboardChartSlice("dashboard.chart.completed", values.Count(job => job.Status == JobStatus.Completed), "primary"));
        slices.Add(new DashboardChartSlice("dashboard.chart.cancelled", values.Count(job => job.Status is JobStatus.Cancelled or JobStatus.Rejected), "danger"));
        return new DashboardChartResponse(titleKey, slices);
    }

    private static bool MatchesJobPendingSlice(JobStatus status, string pendingLabel) => pendingLabel switch
    {
        "dashboard.chart.pendingApproval" or "dashboard.chart.externalPendingApproval" or "dashboard.chart.pending"
            => status is JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval,
        _ => status is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested,
    };

    private static bool IsPastDue(DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        dueDateUtc.HasValue && dueDateUtc.Value < now;

    private static bool MatchesCreatedPeriod(DateTimeOffset createdAtUtc, DateTimeOffset? fromUtc, DateTimeOffset? toUtc) =>
        (!fromUtc.HasValue || createdAtUtc >= fromUtc.Value)
        && (!toUtc.HasValue || createdAtUtc <= toUtc.Value);

    private static bool IsOpenOverdueJob(JobStatus status, DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        IsOpen(status) && IsPastDue(dueDateUtc, now);

    private static bool IsOpenOverdueTask(WorkflowTaskStatus status, DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        IsActionableOpen(status) && IsPastDue(dueDateUtc, now);

    private static bool IsActionableOpen(WorkflowTaskStatus status) => status is not (
        WorkflowTaskStatus.Completed
        or WorkflowTaskStatus.Cancelled
        or WorkflowTaskStatus.Rejected
        or WorkflowTaskStatus.PendingCloseApproval);

    private static bool IsOpen(JobStatus status) => status is not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected);

    private static IEnumerable<TaskStatusItem> FilterTasks(IEnumerable<TaskStatusItem> tasks, TaskDashboardFilter filter) => filter switch
    {
        TaskDashboardFilter.Assigned => tasks.Where(task => task.SourceType != JobSourceType.Routine),
        TaskDashboardFilter.Routine => tasks.Where(task => task.SourceType == JobSourceType.Routine),
        _ => tasks,
    };

    private sealed record TaskStatusItem(Guid? AssignedUserId, WorkflowTaskStatus Status, DateTimeOffset? DueDateUtc, JobSourceType SourceType);
    private sealed record JobStatusItem(JobStatus Status, DateTimeOffset? DueDateUtc, bool HasOpenTasks);
    private sealed record CitizenJobStatusItem(JobStatus Status, DateTimeOffset? DueDateUtc, int TaskCount);

    private enum CitizenJobDisplayStatus
    {
        ProcessingReceived,
        Overdue,
        InProgress,
        Completed,
        Cancelled,
    }

    private static readonly string[] StaffChartColors = ["primary", "success", "info", "warning", "neutral"];
}
