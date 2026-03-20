using CityCommunicationCenter.Application;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.TenantMember)]
public abstract class ApiControllerBase : ControllerBase
{
    private TenantContext? _currentContext;

    protected TenantContext CurrentContext => _currentContext ??= HttpContext.RequestServices
        .GetRequiredService<ITenantContextAccessor>()
        .GetCurrent();

    protected Guid RequiredTenantId => CurrentContext.TenantId
        ?? throw new InvalidOperationException("Tenant baglami bulunamadi.");
}
