using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetDashboardQuery(DateTimeOffset? FromUtc, DateTimeOffset? ToUtc) : IQuery<DashboardResponse>;

public sealed class GetDashboardQueryHandler : IQueryHandler<GetDashboardQuery, DashboardResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<DashboardResponse> Handle(GetDashboardQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;
        var isManagerOrAdmin = context.RoleCode is "Manager" or "SystemAdmin";
        var now = DateTimeOffset.UtcNow;

        var activeTasks = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId
                && entity.CurrentStatus != WorkflowTaskStatus.Completed
                && entity.CurrentStatus != WorkflowTaskStatus.Cancelled
                && entity.CurrentStatus != WorkflowTaskStatus.Rejected
                && entity.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval
                && DashboardMetricRules.MatchesCreatedPeriod(entity.CreatedAtUtc, request.FromUtc, request.ToUtc),
            cancellationToken);

        int pendingApprovals = 0;
        int rejectedOrCancelledRequests = 0;
        int myPendingRequestCount = 0;
        int outgoingPendingCount = 0;
        int outgoingInProgressCount = 0;
        int myPendingTaskCount = 0;
        int deptPendingTaskCount = 0;
        int myTotalRequestCount = 0;
        int incomingTotalCount = 0;
        int outgoingTotalCount = 0;
        int deptTotalTaskCount = 0;

        ApplicationUser? actor = null;
        if (userId.HasValue)
        {
            actor = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == userId.Value && u.TenantId == tenantId && u.IsActive, cancellationToken);
        }

        if (userId.HasValue)
        {
            myPendingTaskCount = await _dbContext.Tasks.CountAsync(
                task => task.TenantId == tenantId
                    && task.AssignedUserId == userId
                    && DashboardMetricRules.IsTaskPendingSlice(task.CurrentStatus, task.DueDateUtc, now)
                    && DashboardMetricRules.MatchesCreatedPeriod(task.CreatedAtUtc, request.FromUtc, request.ToUtc),
                cancellationToken);

            if (isManagerOrAdmin)
            {
                myPendingRequestCount = await _dbContext.Jobs.CountAsync(
                    job => job.TenantId == tenantId
                        && job.RequestType == JobRequestType.ExternalUnit
                        && job.CreatedByUserId == userId
                        && DashboardMetricRules.IsJobPendingSlice(job.Status, job.DueDateUtc, now, pendingApprovalOnly: false)
                        && DashboardMetricRules.MatchesCreatedPeriod(job.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);
            }
            else
            {
                var myRequestsQuery = _dbContext.Jobs.AsNoTracking().Where(job =>
                    job.TenantId == tenantId
                    && job.CreatedByUserId == userId
                    && job.SourceType != JobSourceType.Routine
                    && job.RequestType != JobRequestType.Citizen
                    && DashboardMetricRules.MatchesCreatedPeriod(job.CreatedAtUtc, request.FromUtc, request.ToUtc));

                if (actor is not null && (actor.RoleCode == RoleCode.Operator || UserRoleAccess.IsCitizenRequestManager(actor)))
                {
                    myRequestsQuery = myRequestsQuery.Where(job =>
                        job.SourceType != JobSourceType.SocialMessage
                        && job.SourceType != JobSourceType.CitizenRequest
                        && job.SourceType != JobSourceType.EDevlet);
                }

                if (context.RoleCode == "Reporter")
                {
                    // Reporter tüm oluşturduğu (VT hariç) talepleri görür.
                }
                else if (context.ActiveDepartmentId.HasValue)
                {
                    myRequestsQuery = myRequestsQuery.Where(job => job.OwnerDepartmentId == context.ActiveDepartmentId.Value);
                }

                myPendingRequestCount = await myRequestsQuery.CountAsync(
                    job => DashboardMetricRules.IsJobPendingSlice(job.Status, job.DueDateUtc, now, pendingApprovalOnly: false),
                    cancellationToken);
            }
        }

        if (isManagerOrAdmin && userId.HasValue)
        {
            var scopedDepartmentIds = actor is null
                ? []
                : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                    _dbContext,
                    tenantId,
                    actor,
                    context.ActiveDepartmentId,
                    cancellationToken);

            rejectedOrCancelledRequests = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId
                    && j.SourceType != JobSourceType.Routine
                    && (j.Status == JobStatus.Rejected || j.Status == JobStatus.Cancelled)
                    && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc),
                cancellationToken);

            myTotalRequestCount = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId
                    && j.SourceType != JobSourceType.Routine
                    && j.CreatedByUserId == userId
                    && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc),
                cancellationToken);

            if (scopedDepartmentIds.Length > 0)
            {
                pendingApprovals = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.SourceType != JobSourceType.Routine
                        && DashboardMetricRules.IsJobPendingSlice(j.Status, j.DueDateUtc, now, pendingApprovalOnly: true)
                        && (scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && scopedDepartmentIds.Contains(jd.DepartmentId)))
                        && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);

                outgoingPendingCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && DashboardMetricRules.IsJobPendingSlice(j.Status, j.DueDateUtc, now, pendingApprovalOnly: false)
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);

                outgoingInProgressCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && j.Status == JobStatus.Active
                        && _dbContext.Tasks.Any(t => t.JobId == j.JobId
                            && t.CurrentStatus != WorkflowTaskStatus.Completed
                            && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                            && t.CurrentStatus != WorkflowTaskStatus.Rejected)
                        && !DashboardMetricRules.IsPastDue(j.DueDateUtc, now)
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);

                outgoingTotalCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);

                deptPendingTaskCount = await _dbContext.Tasks.CountAsync(
                    t => t.TenantId == tenantId
                        && t.AssignedDepartmentId.HasValue
                        && scopedDepartmentIds.Contains(t.AssignedDepartmentId.Value)
                        && DashboardMetricRules.IsTaskPendingSlice(t.CurrentStatus, t.DueDateUtc, now)
                        && DashboardMetricRules.MatchesCreatedPeriod(t.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);

                deptTotalTaskCount = await _dbContext.Tasks.CountAsync(
                    t => t.TenantId == tenantId
                        && t.AssignedDepartmentId.HasValue
                        && scopedDepartmentIds.Contains(t.AssignedDepartmentId.Value)
                        && DashboardMetricRules.MatchesCreatedPeriod(t.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);

                incomingTotalCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.SourceType != JobSourceType.Routine
                        && (scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && scopedDepartmentIds.Contains(jd.DepartmentId)))
                        && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc),
                    cancellationToken);
            }
        }

        var openSocialMessages = 0;
        var roleCode = context.RoleCode;
        if (roleCode is "SystemAdmin" or "Operator")
        {
            openSocialMessages = await _dbContext.Jobs
                .Where(j => j.TenantId == tenantId
                    && j.SourceType != JobSourceType.Routine
                    && DashboardMetricRules.IsJobPendingSlice(j.Status, j.DueDateUtc, now, pendingApprovalOnly: true)
                    && _dbContext.SocialMessages.Any(m => m.JobId == j.JobId && m.CitizenRequestNumber != null)
                    && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc))
                .CountAsync(cancellationToken);
        }
        else if (isManagerOrAdmin && userId.HasValue)
        {
            var socialDepartmentIds = actor is null
                ? Array.Empty<Guid>()
                : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(
                    _dbContext,
                    tenantId,
                    actor,
                    context.ActiveDepartmentId,
                    cancellationToken);

            if (socialDepartmentIds.Length > 0)
            {
                openSocialMessages = await _dbContext.Jobs
                    .Where(j => j.TenantId == tenantId
                        && j.SourceType != JobSourceType.Routine
                        && DashboardMetricRules.IsJobPendingSlice(j.Status, j.DueDateUtc, now, pendingApprovalOnly: true)
                        && _dbContext.SocialMessages.Any(m => m.JobId == j.JobId && m.CitizenRequestNumber != null)
                        && (socialDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && socialDepartmentIds.Contains(jd.DepartmentId)))
                        && DashboardMetricRules.MatchesCreatedPeriod(j.CreatedAtUtc, request.FromUtc, request.ToUtc))
                    .CountAsync(cancellationToken);
            }
        }

        return new DashboardResponse(
            activeTasks,
            pendingApprovals,
            openSocialMessages,
            rejectedOrCancelledRequests,
            0,
            myPendingRequestCount,
            outgoingPendingCount,
            outgoingInProgressCount,
            myPendingTaskCount,
            deptPendingTaskCount,
            myTotalRequestCount,
            incomingTotalCount,
            outgoingTotalCount,
            deptTotalTaskCount);
    }
}

internal static class DashboardMetricRules
{
    internal static bool MatchesCreatedPeriod(DateTimeOffset createdAtUtc, DateTimeOffset? fromUtc, DateTimeOffset? toUtc) =>
        (!fromUtc.HasValue || createdAtUtc >= fromUtc.Value)
        && (!toUtc.HasValue || createdAtUtc <= toUtc.Value);

    internal static bool IsPastDue(DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        dueDateUtc.HasValue && dueDateUtc.Value < now;

    internal static bool IsTaskPendingSlice(WorkflowTaskStatus status, DateTimeOffset? dueDateUtc, DateTimeOffset now) =>
        status is not (
            WorkflowTaskStatus.Completed
            or WorkflowTaskStatus.Cancelled
            or WorkflowTaskStatus.Rejected
            or WorkflowTaskStatus.PendingCloseApproval)
        && !IsPastDue(dueDateUtc, now);

    internal static bool IsJobPendingSlice(JobStatus status, DateTimeOffset? dueDateUtc, DateTimeOffset now, bool pendingApprovalOnly)
    {
        if (IsPastDue(dueDateUtc, now))
        {
            return false;
        }

        return pendingApprovalOnly
            ? status is JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval
            : status is JobStatus.Draft
                or JobStatus.PendingOwnerApproval
                or JobStatus.PendingExternalApproval
                or JobStatus.RevisionRequested;
    }
}
