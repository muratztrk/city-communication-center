using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Api.Services;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/me")]
public sealed class MeController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public MeController(
        ITenantContextAccessor tenantContextAccessor,
        CityCommunicationCenterDbContext dbContext)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
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

    [HttpGet("menu-visibility")]
    [ProducesResponseType<MenuVisibilityEvaluationResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<MenuVisibilityEvaluationResponse>> GetMenuVisibility(CancellationToken cancellationToken)
    {
        if (!CurrentContext.IsAuthenticated)
        {
            return Unauthorized(new { error = "Bu işlem için oturum açmanız gerekiyor." });
        }

        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var departmentId = Guid.TryParse(User.FindFirst("department_id")?.Value, out var parsedDepartmentId)
            ? parsedDepartmentId
            : (Guid?)null;

        var menuVisibilityRulesJson = await _dbContext.GetMenuVisibilityRulesJsonAsync(tenantId.Value, cancellationToken);
        var menuVisibilityRules = MenuVisibilityPolicy.Deserialize(menuVisibilityRulesJson);
        var menuVisibility = MenuVisibilityPolicy.EvaluateForUser(
            menuVisibilityRules,
            CurrentContext.RoleCode,
            departmentId);

        return Ok(new MenuVisibilityEvaluationResponse(menuVisibility));
    }
}
