using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetDashboardQuery() : IQuery<DashboardResponse>;

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
        var canSeePendingApprovals = context.RoleCode is "Manager" or "SystemAdmin";

        var activeTasks = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId
                && entity.CurrentStatus != WorkflowTaskStatus.Completed
                && entity.CurrentStatus != WorkflowTaskStatus.Cancelled
                && entity.CurrentStatus != WorkflowTaskStatus.Rejected
                && entity.CurrentStatus != WorkflowTaskStatus.PendingCloseApproval,
            cancellationToken);

        int pendingApprovals = 0;
        int rejectedOrCancelledRequests = 0;
        if (canSeePendingApprovals)
        {
            var pendingJobsOwner = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId && j.Status == JobStatus.PendingOwnerApproval, cancellationToken);
            var pendingJobsExternal = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId && j.Status == JobStatus.PendingExternalApproval, cancellationToken);
            pendingApprovals = pendingJobsOwner + pendingJobsExternal;
            rejectedOrCancelledRequests = await _dbContext.Jobs.CountAsync(
                j => j.TenantId == tenantId && (j.Status == JobStatus.Rejected || j.Status == JobStatus.Cancelled),
                cancellationToken);
        }

        var openSocialMessages = await _dbContext.SocialMessages.CountAsync(
            entity => entity.TenantId == tenantId && entity.Status != SocialMessageStatus.Closed,
            cancellationToken);

        return new DashboardResponse(
            activeTasks,
            pendingApprovals,
            openSocialMessages,
            rejectedOrCancelledRequests,
            0);
    }
}
