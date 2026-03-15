using System.Diagnostics.CodeAnalysis;
using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    private readonly ITenantContextAccessor _tenantContextAccessor;

    protected ApiControllerBase(ITenantContextAccessor tenantContextAccessor)
    {
        _tenantContextAccessor = tenantContextAccessor;
    }

    protected TenantContext CurrentContext => _tenantContextAccessor.GetCurrent();

    protected bool TryGetTenantId([NotNullWhen(true)] out Guid? tenantId, [NotNullWhen(false)] out ActionResult? error)
    {
        tenantId = CurrentContext.TenantId;
        if (tenantId.HasValue)
        {
            error = null;
            return true;
        }

        error = Problem(
            detail: CurrentContext.ErrorMessage,
            statusCode: StatusCodes.Status400BadRequest,
            title: "Tenant context is required.");
        return false;
    }
}
