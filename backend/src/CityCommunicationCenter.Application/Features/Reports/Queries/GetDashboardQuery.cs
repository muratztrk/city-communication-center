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
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var activeTasks = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId && entity.CurrentStatus != WorkflowTaskStatus.Closed,
            cancellationToken);
        var pendingApprovals = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId && entity.CurrentStatus == WorkflowTaskStatus.PendingApproval,
            cancellationToken);
        var openSocialMessages = await _dbContext.SocialMessages.CountAsync(
            entity => entity.TenantId == tenantId && entity.Status != SocialMessageStatus.Closed,
            cancellationToken);
        var failedNotifications = await _dbContext.Notifications.CountAsync(
            entity => entity.TenantId == tenantId && entity.DeliveryStatus == NotificationDeliveryStatus.Failed,
            cancellationToken);

        return new DashboardResponse(
            activeTasks,
            pendingApprovals,
            openSocialMessages,
            failedNotifications);
    }
}