using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetDashboardQuery() : IQuery<DashboardResponse>;

public sealed class GetDashboardQueryHandler : IRequestHandler<GetDashboardQuery, DashboardResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetDashboardQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<DashboardResponse> Handle(GetDashboardQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId!.Value;
        var canSeePendingApprovals = context.RoleCode is "Manager" or "SystemAdmin";

        var activeTasks = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId && entity.CurrentStatus != WorkflowTaskStatus.Closed,
            cancellationToken);
        var pendingApprovals = canSeePendingApprovals
            ? await _dbContext.Tasks.CountAsync(
                entity => entity.TenantId == tenantId && entity.CurrentStatus == WorkflowTaskStatus.PendingApproval,
                cancellationToken)
            : 0;
        var openSocialMessages = await _dbContext.SocialMessages.CountAsync(
            entity => entity.TenantId == tenantId && entity.Status != SocialMessageStatus.Closed,
            cancellationToken);

        return new DashboardResponse(
            activeTasks,
            pendingApprovals,
            openSocialMessages,
            0);
    }
}