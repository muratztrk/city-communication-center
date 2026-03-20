using CityCommunicationCenter.Application.Services;

namespace CityCommunicationCenter.Application.Features.Routing;

public sealed record GetRoutingConfigQuery() : IQuery<RoutingConfigResponse>;

public sealed class GetRoutingConfigQueryHandler : IRequestHandler<GetRoutingConfigQuery, RoutingConfigResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IRoutingService _routingService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetRoutingConfigQueryHandler(IApplicationDbContext dbContext, IRoutingService routingService, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _routingService = routingService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<RoutingConfigResponse> Handle(GetRoutingConfigQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var isEnabled = await _routingService.IsAutoRoutingEnabledAsync(tenantId, cancellationToken);
        var rules = await _dbContext.RoutingRules.ToListAsync(cancellationToken);
        var departments = await _dbContext.Departments.ToListAsync(cancellationToken);
        var departmentLookup = departments.ToDictionary(entity => entity.DepartmentId, entity => entity.Name);

        var responses = rules
            .OrderByDescending(entity => entity.Priority)
            .Select(entity => new RoutingRuleResponse(
                entity.RuleId,
                entity.RuleName,
                entity.Keywords,
                entity.TargetDepartmentId,
                departmentLookup.GetValueOrDefault(entity.TargetDepartmentId, "Bilinmeyen"),
                entity.Priority,
                entity.IsActive))
            .ToList();

        return new RoutingConfigResponse(isEnabled, responses);
    }
}