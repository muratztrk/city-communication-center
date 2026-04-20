using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetDashboardChartQuery() : IQuery<DashboardChartResponse>;

public sealed class GetDashboardChartQueryHandler : IRequestHandler<GetDashboardChartQuery, DashboardChartResponse>
{
    private static readonly string[] SliceColors = ["primary", "success", "info", "warning", "danger", "neutral"];

    // Completed/done statuses
    private static readonly WorkflowTaskStatus[] DoneStatuses =
        [WorkflowTaskStatus.Completed, WorkflowTaskStatus.Closed];

    // Active/pending statuses (not draft, not done, not rejected)
    private static readonly WorkflowTaskStatus[] PendingStatuses =
        [WorkflowTaskStatus.PendingApproval, WorkflowTaskStatus.Assigned, WorkflowTaskStatus.InProgress];

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardChartQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<DashboardChartResponse> Handle(GetDashboardChartQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;
        var userId = context.UserId;
        var roleCode = context.RoleCode;

        if (roleCode == "Manager" && userId.HasValue)
        {
            return await BuildManagerChartAsync(tenantId, userId.Value, cancellationToken);
        }

        if ((roleCode == "Staff" || roleCode == "Operator") && userId.HasValue)
        {
            return await BuildStaffChartAsync(tenantId, userId.Value, cancellationToken);
        }

        return await BuildDepartmentChartAsync(tenantId, cancellationToken);
    }

    /// <summary>
    /// Admin / Reporter / Mayor: per-department completed and pending counts.
    /// </summary>
    private async Task<DashboardChartResponse> BuildDepartmentChartAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var allTasks = await (
            from task in _dbContext.Tasks.AsNoTracking()
            where task.TenantId == tenantId &&
                  (DoneStatuses.Contains(task.CurrentStatus) || PendingStatuses.Contains(task.CurrentStatus))
            let deptId = task.AssignedDepartmentId ?? task.TargetDepartmentId
            where deptId != null
            join dept in _dbContext.Departments.AsNoTracking()
                on deptId equals dept.DepartmentId
            select new { dept.Name, IsDone = DoneStatuses.Contains(task.CurrentStatus) }
        ).ToListAsync(cancellationToken);

        var grouped = allTasks
            .GroupBy(x => x.Name)
            .Select(g => new
            {
                DeptName = g.Key,
                Completed = g.Count(x => x.IsDone),
                Pending = g.Count(x => !x.IsDone),
            })
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

    /// <summary>
    /// Manager: per-person completed tasks in managed dept(s), plus total pending in those depts.
    /// </summary>
    private async Task<DashboardChartResponse> BuildManagerChartAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken)
    {
        var managedDeptIds = await _dbContext.Departments
            .AsNoTracking()
            .Where(d => d.ManagerUserId == userId)
            .Select(d => d.DepartmentId)
            .ToArrayAsync(cancellationToken);

        if (managedDeptIds.Length == 0)
        {
            return new DashboardChartResponse("dashboard.chart.titleManager", []);
        }

        var tasks = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t =>
                t.TenantId == tenantId &&
                (DoneStatuses.Contains(t.CurrentStatus) || PendingStatuses.Contains(t.CurrentStatus)) &&
                ((t.AssignedDepartmentId.HasValue && managedDeptIds.Contains(t.AssignedDepartmentId.Value)) ||
                 (t.TargetDepartmentId.HasValue && managedDeptIds.Contains(t.TargetDepartmentId.Value) && t.AssignedDepartmentId == null)))
            .Select(t => new { t.AssignedUserId, IsDone = DoneStatuses.Contains(t.CurrentStatus) })
            .ToListAsync(cancellationToken);

        // Per-person completed counts
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

        // Total pending in managed depts
        var totalPending = tasks.Count(t => !t.IsDone);
        if (totalPending > 0)
        {
            slices.Add(new DashboardChartSlice("dashboard.chart.deptTotalPending", totalPending, "warning"));
        }

        return new DashboardChartResponse("dashboard.chart.titleManager", slices);
    }

    /// <summary>
    /// Staff / Operator: my completed, my pending, dept completed (others), dept pending (others).
    /// </summary>
    private async Task<DashboardChartResponse> BuildStaffChartAsync(Guid tenantId, Guid userId, CancellationToken cancellationToken)
    {
        var actor = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.UserId == userId)
            .Select(u => new { u.DepartmentId })
            .FirstOrDefaultAsync(cancellationToken);

        if (actor is null)
        {
            return new DashboardChartResponse("dashboard.chart.titleStaff", []);
        }

        var deptId = actor.DepartmentId;

        var deptTasks = await _dbContext.Tasks
            .AsNoTracking()
            .Where(t =>
                t.TenantId == tenantId &&
                (DoneStatuses.Contains(t.CurrentStatus) || PendingStatuses.Contains(t.CurrentStatus)) &&
                ((t.AssignedDepartmentId == deptId) ||
                 (t.TargetDepartmentId == deptId && t.AssignedDepartmentId == null)))
            .Select(t => new { t.AssignedUserId, IsDone = DoneStatuses.Contains(t.CurrentStatus) })
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
