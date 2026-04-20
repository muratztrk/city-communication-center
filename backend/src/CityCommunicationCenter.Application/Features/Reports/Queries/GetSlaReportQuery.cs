using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetSlaReportQuery() : IQuery<SlaReportResponse>;

public sealed class GetSlaReportQueryHandler : IRequestHandler<GetSlaReportQuery, SlaReportResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetSlaReportQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<SlaReportResponse> Handle(GetSlaReportQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var utcNow = DateTimeOffset.UtcNow;
        var startOfDay = utcNow.Date;
        var endOfDay = startOfDay.AddDays(1);

        var overdueTasks = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId
                && entity.CurrentStatus != WorkflowTaskStatus.Completed
                && entity.CurrentStatus != WorkflowTaskStatus.Cancelled
                && entity.DueDateUtc.HasValue
                && entity.DueDateUtc.Value < utcNow,
            cancellationToken);
        var tasksDueToday = await _dbContext.Tasks.CountAsync(
            entity => entity.TenantId == tenantId
                && entity.DueDateUtc.HasValue
                && entity.DueDateUtc.Value >= startOfDay
                && entity.DueDateUtc.Value < endOfDay,
            cancellationToken);

        return new SlaReportResponse(overdueTasks, tasksDueToday);
    }
}
