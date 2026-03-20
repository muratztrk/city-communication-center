using Microsoft.AspNetCore.Mvc.Filters;

namespace CityCommunicationCenter.Api.Filters;

public sealed class ValidateTenantFilter : IAsyncActionFilter
{
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public ValidateTenantFilter(ITenantContextAccessor tenantContextAccessor)
    {
        _tenantContextAccessor = tenantContextAccessor;
    }

    public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var tenantContext = _tenantContextAccessor.GetCurrent();
        if (!tenantContext.TenantId.HasValue)
        {
            context.Result = new ObjectResult(new ProblemDetails
            {
                Title = "Tenant baglami gerekli.",
                Detail = "Istekte gecerli bir tenant claim'i veya X-Tenant-Id basligi bulunmalidir.",
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
                Title = "Tenant uyumsuzlugu algilandi.",
                Detail = "Rota uzerindeki tenant bilgisi, istek baglamindaki tenant ile ayni olmalidir.",
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