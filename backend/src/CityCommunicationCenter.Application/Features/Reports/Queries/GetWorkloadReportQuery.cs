using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Reports;

public sealed record GetWorkloadReportQuery() : IQuery<IReadOnlyList<WorkloadReportItemResponse>>;

public sealed class GetWorkloadReportQueryHandler : IQueryHandler<GetWorkloadReportQuery, IReadOnlyList<WorkloadReportItemResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetWorkloadReportQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<WorkloadReportItemResponse>> Handle(GetWorkloadReportQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        return await _dbContext.Tasks
            .Where(entity => entity.TenantId == tenantId
                && entity.AssignedDepartmentId.HasValue
                && entity.CurrentStatus != WorkflowTaskStatus.Completed
                && entity.CurrentStatus != WorkflowTaskStatus.Cancelled)
            .GroupBy(entity => entity.AssignedDepartmentId!.Value)
            .Select(group => new WorkloadReportItemResponse(group.Key, group.Count()))
            .ToListAsync(cancellationToken);
    }
}
