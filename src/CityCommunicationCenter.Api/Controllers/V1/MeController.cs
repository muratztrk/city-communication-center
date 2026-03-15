using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/me")]
public sealed class MeController : ApiControllerBase
{
    public MeController(ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
    }

    [HttpGet]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    public ActionResult<CurrentUserResponse> Get()
    {
        var context = CurrentContext;
        return Ok(new CurrentUserResponse(
            context.TenantId,
            context.UserId,
            context.UserDisplayName,
            context.RoleCode,
            context.IsAuthenticated,
            context.ResolutionSource));
    }
}
