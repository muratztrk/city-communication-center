namespace CityCommunicationCenter.Application.Services;

public interface IRoutingService
{
    /// <summary>
    /// Determines the target department for a message based on routing rules.
    /// Returns null if no matching rule found or auto-routing is disabled.
    /// </summary>
    Task<Guid?> GetTargetDepartmentAsync(Guid tenantId, string messageContent, CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if auto-routing is enabled for the tenant.
    /// </summary>
    Task<bool> IsAutoRoutingEnabledAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Enables or disables auto-routing for the tenant.
    /// </summary>
    Task SetAutoRoutingEnabledAsync(Guid tenantId, bool enabled, CancellationToken cancellationToken = default);
}
