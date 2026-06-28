using CityCommunicationCenter.Application.Features.Users;
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

        var activeTasks = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId
                && entity.CurrentStatus != WorkflowTaskStatus.Completed
                && entity.CurrentStatus != WorkflowTaskStatus.Cancelled
                && entity.CurrentStatus != WorkflowTaskStatus.Rejected
                && entity.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval
                && (!request.FromUtc.HasValue || entity.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || entity.CreatedAtUtc <= request.ToUtc.Value),
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

        if (userId.HasValue)
        {
            // Card 1: My pending requests (internal + external combined) — for every user
            myPendingRequestCount = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId
                    && j.SourceType != JobSourceType.Routine
                    && j.CreatedByUserId == userId
                    && j.Status != JobStatus.Completed
                    && j.Status != JobStatus.Cancelled
                    && j.Status != JobStatus.Rejected
                    && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                    && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                cancellationToken);

            // Card 4: My pending tasks — for every user
            myPendingTaskCount = await _dbContext.Tasks.CountAsync(
                t => t.TenantId == tenantId
                    && t.AssignedUserId == userId
                    && t.CurrentStatus != WorkflowTaskStatus.Completed
                    && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                    && t.CurrentStatus != WorkflowTaskStatus.Rejected
                    && t.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval
                    && (!request.FromUtc.HasValue || t.CreatedAtUtc >= request.FromUtc.Value)
                    && (!request.ToUtc.HasValue || t.CreatedAtUtc <= request.ToUtc.Value),
                cancellationToken);
        }

        if (isManagerOrAdmin && userId.HasValue)
        {
            var actor = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == userId.Value && u.TenantId == tenantId && u.IsActive, cancellationToken);
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
                    && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                    && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                cancellationToken);

            // Card 7: All my requests (total)
            myTotalRequestCount = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId
                    && j.SourceType != JobSourceType.Routine
                    && j.CreatedByUserId == userId
                    && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                    && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                cancellationToken);

            if (scopedDepartmentIds.Length > 0)
            {
                // Dashboard yalnızca yöneticinin aktif/kapsamındaki birime ait onayları
                // göstermelidir; tenant genelindeki bekleyen kayıtlar yanıltıcıdır.
                pendingApprovals = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.SourceType != JobSourceType.Routine
                        && (j.Status == JobStatus.PendingOwnerApproval || j.Status == JobStatus.PendingExternalApproval)
                        && (scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && scopedDepartmentIds.Contains(jd.DepartmentId)))
                        && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                        && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                    cancellationToken);

                // Card 3: Outgoing pending = external jobs from this dept still awaiting approval
                outgoingPendingCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && (j.Status == JobStatus.PendingOwnerApproval || j.Status == JobStatus.PendingExternalApproval)
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                        && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                    cancellationToken);

                // Outgoing in-progress = approved external jobs that already have tasks in flight
                outgoingInProgressCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && j.Status == JobStatus.Active
                        && _dbContext.Tasks.Any(t => t.JobId == j.JobId)
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                        && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                    cancellationToken);

                // Card 9: Outgoing total
                outgoingTotalCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.RequestType == JobRequestType.ExternalUnit
                        && scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                        && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                        && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                    cancellationToken);

                // Card 5: Dept pending tasks
                deptPendingTaskCount = await _dbContext.Tasks.CountAsync(
                    t => t.TenantId == tenantId
                        && t.AssignedDepartmentId.HasValue
                        && scopedDepartmentIds.Contains(t.AssignedDepartmentId.Value)
                        && t.CurrentStatus != WorkflowTaskStatus.Completed
                        && t.CurrentStatus != WorkflowTaskStatus.Cancelled
                        && t.CurrentStatus != WorkflowTaskStatus.Rejected
                        && t.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval
                        && (!request.FromUtc.HasValue || t.CreatedAtUtc >= request.FromUtc.Value)
                        && (!request.ToUtc.HasValue || t.CreatedAtUtc <= request.ToUtc.Value),
                    cancellationToken);

                // Card 10: Dept total tasks
                deptTotalTaskCount = await _dbContext.Tasks.CountAsync(
                    t => t.TenantId == tenantId
                        && t.AssignedDepartmentId.HasValue
                        && scopedDepartmentIds.Contains(t.AssignedDepartmentId.Value)
                        && (!request.FromUtc.HasValue || t.CreatedAtUtc >= request.FromUtc.Value)
                        && (!request.ToUtc.HasValue || t.CreatedAtUtc <= request.ToUtc.Value),
                    cancellationToken);

                // Birime gelen toplam: birimin kendi iç talep havuzu ile hedef olduğu
                // dış talepler birlikte sayılır.
                incomingTotalCount = await _dbContext.Jobs.CountAsync(
                    j => j.TenantId == tenantId
                        && j.SourceType != JobSourceType.Routine
                        && (scopedDepartmentIds.Contains(j.OwnerDepartmentId)
                            || _dbContext.JobDepartments.Any(jd => jd.JobId == j.JobId
                                && jd.Role == JobDepartmentRole.Target
                                && scopedDepartmentIds.Contains(jd.DepartmentId)))
                        && (!request.FromUtc.HasValue || j.CreatedAtUtc >= request.FromUtc.Value)
                        && (!request.ToUtc.HasValue || j.CreatedAtUtc <= request.ToUtc.Value),
                    cancellationToken);
            }
        }

        var openSocialMessages = await _dbContext.SocialMessages.CountAsync(
            entity => entity.TenantId == tenantId
                && entity.Status != SocialMessageStatus.Closed
                && (!request.FromUtc.HasValue || entity.CreatedAtUtc >= request.FromUtc.Value)
                && (!request.ToUtc.HasValue || entity.CreatedAtUtc <= request.ToUtc.Value),
            cancellationToken);

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
