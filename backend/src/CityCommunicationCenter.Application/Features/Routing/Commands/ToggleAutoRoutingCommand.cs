namespace CityCommunicationCenter.Application.Features.Routing;

public sealed record ToggleAutoRoutingCommand(bool Enabled) : ICommand<Unit>;

public sealed class ToggleAutoRoutingCommandHandler : ICommandHandler<ToggleAutoRoutingCommand, Unit>
{
    private readonly IRoutingService _routingService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ToggleAutoRoutingCommandHandler(IRoutingService routingService, ITenantContextAccessor tenantContextAccessor)
    {
        _routingService = routingService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(ToggleAutoRoutingCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        await _routingService.SetAutoRoutingEnabledAsync(tenantId, request.Enabled, cancellationToken);
        return Unit.Value;
    }
}