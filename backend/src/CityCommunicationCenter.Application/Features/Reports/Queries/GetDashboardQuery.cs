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
        var fromUtc = request.FromUtc;
        var toUtc = request.ToUtc;

        var activeTasks = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId
                && entity.CurrentStatus != WorkflowTaskStatus.Completed
                && entity.CurrentStatus != WorkflowTaskStatus.Cancelled
                && entity.CurrentStatus != WorkflowTaskStatus.Rejected
                && entity.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval
                && (!fromUtc.HasValue || entity.CreatedAtUtc >= fromUtc.Value)
                && (!toUtc.HasValue || entity.CreatedAtUtc <= toUtc.Value),
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
                    && task.CurrentStatus != WorkflowTaskStatus.Completed
                    && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && task.CurrentStatus != WorkflowTaskStatus.Rejected
                    && task.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval
                    && (!task.DueDateUtc.HasValue || task.DueDateUtc >= now)
                    && (!fromUtc.HasValue || task.CreatedAtUtc >= fromUtc.Value)
                    && (!toUtc.HasValue || task.CreatedAtUtc <= toUtc.Value),
                cancellationToken);

            if (isManagerOrAdmin)
            {
                myPendingRequestCount = await _dbContext.Jobs.CountAsync(
                    job => job.TenantId == tenantId
                        && job.RequestType == JobRequestType.ExternalUnit
                        && job.CreatedByUserId == userId
                        && (!job.DueDateUtc.HasValue || job.DueDateUtc >= now)
                        && (job.Status == JobStatus.Draft
                            || job.Status == JobStatus.PendingOwnerApproval
                            || job.Status == JobStatus.PendingExternalApproval
                            || job.Status == JobStatus.RevisionRequested)
                        && (!fromUtc.HasValue || job.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || job.CreatedAtUtc <= toUtc.Value),
                    cancellationToken);
            }
            else
            {
                var myRequestsQuery = _dbContext.Jobs.AsNoTracking().Where(job =>
                    job.TenantId == tenantId
                    && job.CreatedByUserId == userId
                    && job.SourceType != JobSourceType.Routine
                    && job.RequestType != JobRequestType.Citizen
                    && (!fromUtc.HasValue || job.CreatedAtUtc >= fromUtc.Value)
                    && (!toUtc.HasValue || job.CreatedAtUtc <= toUtc.Value));

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
                    job => (!job.DueDateUtc.HasValue || job.DueDateUtc >= now)
                        && (job.Status == JobStatus.Draft
                            || job.Status == JobStatus.PendingOwnerApproval
                            || job.Status == JobStatus.PendingExternalApproval
                            || job.Status == JobStatus.RevisionRequested),
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
                    && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                    && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value),
                cancellationToken);

            myTotalRequestCount = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId
                    && j.SourceType != JobSourceType.Routine
                    && j.CreatedByUserId == userId
                    && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                    && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value),
                cancellationToken);

            if (scopedDepartmentIds.Length > 0)
            {
                pendingApprovals = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.SourceType != JobSourceType.Routine
                        && (!j.DueDateUtc.HasValue || j.DueDateUtc >= now)
                        && (j.Status == JobStatus.PendingOwnerApproval || j.Status == JobStatus.PendingExternalApproval)
                        && (scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && scopedDepartmentIds.Contains(jd.DepartmentId)))
                        && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value),
                    cancellationToken);

                outgoingPendingCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && (!j.DueDateUtc.HasValue || j.DueDateUtc >= now)
                        && (j.Status == JobStatus.Draft
                            || j.Status == JobStatus.PendingOwnerApproval
                            || j.Status == JobStatus.PendingExternalApproval
                            || j.Status == JobStatus.RevisionRequested)
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value),
                    cancellationToken);

                outgoingInProgressCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && j.Status == JobStatus.Active
                        && _dbContext.Tasks.Any(t => t.JobId == j.JobId
                            && t.CurrentStatus != WorkflowTaskStatus.Completed
                            && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                            && t.CurrentStatus != WorkflowTaskStatus.Rejected)
                        && (!j.DueDateUtc.HasValue || j.DueDateUtc >= now)
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value),
                    cancellationToken);

                outgoingTotalCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value),
                    cancellationToken);

                deptPendingTaskCount = await _dbContext.Tasks.CountAsync(
                    t => t.TenantId == tenantId
                        && t.AssignedDepartmentId.HasValue
                        && scopedDepartmentIds.Contains(t.AssignedDepartmentId.Value)
                        && t.CurrentStatus != WorkflowTaskStatus.Completed
                        && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                        && t.CurrentStatus != WorkflowTaskStatus.Rejected
                        && t.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval
                        && (!t.DueDateUtc.HasValue || t.DueDateUtc >= now)
                        && (!fromUtc.HasValue || t.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || t.CreatedAtUtc <= toUtc.Value),
                    cancellationToken);

                deptTotalTaskCount = await _dbContext.Tasks.CountAsync(
                    t => t.TenantId == tenantId
                        && t.AssignedDepartmentId.HasValue
                        && scopedDepartmentIds.Contains(t.AssignedDepartmentId.Value)
                        && (!fromUtc.HasValue || t.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || t.CreatedAtUtc <= toUtc.Value),
                    cancellationToken);

                incomingTotalCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.SourceType != JobSourceType.Routine
                        && (scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && scopedDepartmentIds.Contains(jd.DepartmentId)))
                        && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value),
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
                    && (!j.DueDateUtc.HasValue || j.DueDateUtc >= now)
                    && (j.Status == JobStatus.PendingOwnerApproval || j.Status == JobStatus.PendingExternalApproval)
                    && _dbContext.SocialMessages.Any(m => m.JobId == j.JobId && m.CitizenRequestNumber != null)
                    && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                    && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value))
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
                        && (!j.DueDateUtc.HasValue || j.DueDateUtc >= now)
                        && (j.Status == JobStatus.PendingOwnerApproval || j.Status == JobStatus.PendingExternalApproval)
                        && _dbContext.SocialMessages.Any(m => m.JobId == j.JobId && m.CitizenRequestNumber != null)
                        && (socialDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && socialDepartmentIds.Contains(jd.DepartmentId)))
                        && (!fromUtc.HasValue || j.CreatedAtUtc >= fromUtc.Value)
                        && (!toUtc.HasValue || j.CreatedAtUtc <= toUtc.Value))
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
