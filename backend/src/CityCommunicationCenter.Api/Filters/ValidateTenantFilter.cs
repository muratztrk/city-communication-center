using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Api.Filters;

public sealed class ValidateTenantFilter : IAsyncActionFilter
{
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IStringLocalizer<SharedResource> _localizer;

    public ValidateTenantFilter(ITenantContextAccessor tenantContextAccessor, IStringLocalizer<SharedResource> localizer)
    {
        _tenantContextAccessor = tenantContextAccessor;
        _localizer = localizer;
    }

    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var tenantContext = _tenantContextAccessor.GetCurrent();
        if (!tenantContext.TenantId.HasValue)
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = _localizer["TenantContextRequiredTitle"],
                Detail = _localizer["TenantContextRequiredDetail"],
                Status = StatusCodes.Status400BadRequest
            })
            {
                StatusCode = StatusCodes.Status400BadRequest
            };

            return Task.CompletedTask;
        }

        if (context.RouteData.Values.TryGetValue("tenantId", out var routeValue) &&
            Guid.TryParse(routeValue?.ToString(), out var routeTenantId) &&
            routeTenantId != tenantContext.TenantId.Value)
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = _localizer["TenantMismatchTitle"],
                Detail = _localizer["TenantMismatchDetail"],
                Status = StatusCodes.Status403Forbidden
            })
            {
                StatusCode = StatusCodes.Status403Forbidden
            };

            return Task.CompletedTask;
        }

        return next();
    }
}