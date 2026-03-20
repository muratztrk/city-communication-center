using CityCommunicationCenter.Application.Services;

namespace CityCommunicationCenter.Application.Features.Routing;

public sealed record TestRoutingQuery(string MessageContent) : IQuery<RoutingTestResponse>;

public sealed class TestRoutingQueryHandler : IRequestHandler<TestRoutingQuery, RoutingTestResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IRoutingService _routingService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public TestRoutingQueryHandler(IApplicationDbContext dbContext, IRoutingService routingService, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _routingService = routingService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<RoutingTestResponse> Handle(TestRoutingQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var departmentId = await _routingService.GetTargetDepartmentAsync(tenantId, request.MessageContent, cancellationToken);
        var departmentName = departmentId.HasValue
            ? await _dbContext.Departments
                .Where(entity => entity.DepartmentId == departmentId.Value)
                .Select(entity => entity.Name)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        return new RoutingTestResponse(departmentId, departmentName);
    }
}