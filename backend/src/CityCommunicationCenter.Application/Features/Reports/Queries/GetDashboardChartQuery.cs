using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetDashboardChartQuery(DateTimeOffset? FromUtc, DateTimeOffset? ToUtc) : IQuery<DashboardChartResponse>;

public sealed class GetDashboardChartQueryHandler : IQueryHandler<GetDashboardChartQuery, DashboardChartResponse>
{
    private static readonly string[] SliceColors = ["primary", "success", "info", "warning", "danger", "neutral"];

    private static readonly WorkflowTaskStatus[] DoneStatuses = [WorkflowTaskStatus.Completed];
    private static readonly WorkflowTaskStatus[] PendingStatuses =
        [WorkflowTaskStatus.Waiting, WorkflowTaskStatus.Assigned, WorkflowTaskStatus.InProgress,
         WorkflowTaskStatus.RevisionRequested];

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardChartQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DashboardChartResponse> Handle(GetDashboardChartQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;
        var roleCode = context.RoleCode;

        if (roleCode == "Manager" && userId.HasValue)
        {
            var actor = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user => user.TenantId == tenantId && user.UserId == userId.Value && user.IsActive, cancellationToken);
            var departmentIds = actor is null
                ? []
                : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                    _dbContext,
                    tenantId,
                    actor,
                    context.ActiveDepartmentId,
                    cancellationToken);

            return await BuildManagerChartAsync(tenantId, departmentIds, request.FromUtc, request.ToUtc, cancellationToken);
        }

        if ((roleCode == "Staff" || roleCode == "Operator") && userId.HasValue)
        {
            var actor = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(user => user.TenantId == tenantId && user.UserId == userId.Value && user.IsActive, cancellationToken);
            var departmentIds = actor is null
                ? []
                : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                    _dbContext,
                    tenantId,
                    actor,
                    context.ActiveDepartmentId,
                    cancellationToken);

            return await BuildStaffChartAsync(tenantId, userId.Value, departmentIds, request.FromUtc, request.ToUtc, cancellationToken);
        }

        return await BuildDepartmentChartAsync(tenantId, request.FromUtc, request.ToUtc, cancellationToken);
    }

    private async Task<DashboardChartResponse> BuildDepartmentChartAsync(Guid tenantId, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, CancellationToken cancellationToken)
    {
        var allTasks = await _dbContext.Tasks
            .AsNoTracking()
            .Where(task => task.TenantId == tenantId
                && (DoneStatuses.Contains(task.CurrentStatus) || PendingStatuses.Contains(task.CurrentStatus))
                && (!fromUtc.HasValue || task.CreatedAtUtc >= fromUtc.Value)
                && (!toUtc.HasValue || task.CreatedAtUtc <= toUtc.Value))
            .Join(
                _dbContext.Jobs.AsNoTracking(),
                task => task.JobId,
                job => job.JobId,
                (task, job) => new
                {
                    task,
                    DepartmentId = task.AssignedDepartmentId ?? job.OwnerDepartmentId,
                })
            .Join(
                _dbContext.Departments.AsNoTracking(),
                item => item.DepartmentId,
                dept => dept.DepartmentId,
                (item, dept) => new { dept.Name, IsDone = DoneStatuses.Contains(item.task.CurrentStatus) })
            .ToListAsync(cancellationToken);

        var grouped = allTasks
            .GroupBy(x => x.Name)
            .Select(g => new { DeptName = g.Key, Completed = g.Count(x => x.IsDone), Pending = g.Count(x => !x.IsDone) })
            .Where(x => x.Completed + x.Pending > 0)
            .OrderByDescending(x => x.Completed + x.Pending)
            .ToList();

        var slices = new List<DashboardChartSlice>();
        int colorIdx = 0;
        foreach (var dept in grouped)
        {
            var color = SliceColors[colorIdx % SliceColors.Length];
            if (dept.Completed > 0)
                slices.Add(new DashboardChartSlice($"{dept.DeptName} – dashboard.chart.completed", dept.Completed, color));
            if (dept.Pending > 0)
                slices.Add(new DashboardChartSlice($"{dept.DeptName} – dashboard.chart.pending", dept.Pending, "warning"));
            colorIdx++;
        }

        return new DashboardChartResponse("dashboard.chart.titleDept", slices);
    }

    private async Task<DashboardChartResponse> BuildManagerChartAsync(Guid tenantId, Guid[] departmentIds, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, CancellationToken cancellationToken)
    {
        if (departmentIds.Length == 0)
        {
            return new DashboardChartResponse("dashboard.chart.titleManager", []);
        }

        var tasks = await _dbContext.Tasks
            .AsNoTracking()
            .Join(
                _dbContext.Jobs.AsNoTracking(),
                task => task.JobId,
                job => job.JobId,
                (task, job) => new { task, job })
            .Where(item => item.task.TenantId == tenantId
                && (DoneStatuses.Contains(item.task.CurrentStatus) || PendingStatuses.Contains(item.task.CurrentStatus))
                && ((item.task.AssignedDepartmentId.HasValue && departmentIds.Contains(item.task.AssignedDepartmentId.Value))
                    || departmentIds.Contains(item.job.OwnerDepartmentId))
                && (!fromUtc.HasValue || item.task.CreatedAtUtc >= fromUtc.Value)
                && (!toUtc.HasValue || item.task.CreatedAtUtc <= toUtc.Value))
            .Select(item => new { item.task.AssignedUserId, IsDone = DoneStatuses.Contains(item.task.CurrentStatus) })
            .ToListAsync(cancellationToken);

        var byUser = tasks
            .Where(t => t.IsDone && t.AssignedUserId.HasValue)
            .GroupBy(t => t.AssignedUserId!.Value)
            .ToList();

        var userIds = byUser.Select(g => g.Key).ToArray();
        var userNames = await _dbContext.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.DisplayName, cancellationToken);

        var slices = new List<DashboardChartSlice>();
        int colorIdx = 0;

        foreach (var group in byUser.OrderByDescending(g => g.Count()))
        {
            var name = userNames.GetValueOrDefault(group.Key, "?");
            slices.Add(new DashboardChartSlice(name, group.Count(), SliceColors[colorIdx % SliceColors.Length]));
            colorIdx++;
        }

        var totalPending = tasks.Count(t => !t.IsDone);
        if (totalPending > 0)
        {
            slices.Add(new DashboardChartSlice("dashboard.chart.deptTotalPending", totalPending, "warning"));
        }

        return new DashboardChartResponse("dashboard.chart.titleManager", slices);
    }

    private async Task<DashboardChartResponse> BuildStaffChartAsync(Guid tenantId, Guid userId, Guid[] departmentIds, DateTimeOffset? fromUtc, DateTimeOffset? toUtc, CancellationToken cancellationToken)
    {
        if (departmentIds.Length == 0)
        {
            return new DashboardChartResponse("dashboard.chart.titleStaff", []);
        }

        var deptTasks = await _dbContext.Tasks
            .AsNoTracking()
            .Join(
                _dbContext.Jobs.AsNoTracking(),
                task => task.JobId,
                job => job.JobId,
                (task, job) => new { task, job })
            .Where(item => item.task.TenantId == tenantId
                && (DoneStatuses.Contains(item.task.CurrentStatus) || PendingStatuses.Contains(item.task.CurrentStatus))
                && ((item.task.AssignedDepartmentId.HasValue && departmentIds.Contains(item.task.AssignedDepartmentId.Value))
                    || departmentIds.Contains(item.job.OwnerDepartmentId))
                && (!fromUtc.HasValue || item.task.CreatedAtUtc >= fromUtc.Value)
                && (!toUtc.HasValue || item.task.CreatedAtUtc <= toUtc.Value))
            .Select(item => new { item.task.AssignedUserId, IsDone = DoneStatuses.Contains(item.task.CurrentStatus) })
            .ToListAsync(cancellationToken);

        var myCompleted = deptTasks.Count(t => t.IsDone && t.AssignedUserId == userId);
        var myPending = deptTasks.Count(t => !t.IsDone && t.AssignedUserId == userId);
        var deptCompleted = deptTasks.Count(t => t.IsDone && t.AssignedUserId != userId);
        var deptPending = deptTasks.Count(t => !t.IsDone && t.AssignedUserId != userId);

        var slices = new List<DashboardChartSlice>();
        if (myCompleted > 0) slices.Add(new DashboardChartSlice("dashboard.chart.myCompleted", myCompleted, "success"));
        if (myPending > 0) slices.Add(new DashboardChartSlice("dashboard.chart.myPending", myPending, "warning"));
        if (deptCompleted > 0) slices.Add(new DashboardChartSlice("dashboard.chart.deptCompleted", deptCompleted, "primary"));
        if (deptPending > 0) slices.Add(new DashboardChartSlice("dashboard.chart.deptPending", deptPending, "neutral"));

        return new DashboardChartResponse("dashboard.chart.titleStaff", slices);
    }
}
