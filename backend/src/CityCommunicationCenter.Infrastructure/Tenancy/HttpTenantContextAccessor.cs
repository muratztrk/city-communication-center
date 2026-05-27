using System.Security.Claims;
using CityCommunicationCenter.Application;
using Microsoft.AspNetCore.Http;

namespace CityCommunicationCenter.Infrastructure.Tenancy;

public sealed class HttpTenantContextAccessor : ITenantContextAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly TenantResolutionOptions _options;

    public HttpTenantContextAccessor(
        IHttpContextAccessor httpContextAccessor,
        IOptions<TenantResolutionOptions> options)
    {
        _httpContextAccessor = httpContextAccessor;
        _options = options.Value;
    }

    public TenantContext GetCurrent()
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return new TenantContext(
                null,
                null,
                null,
                null,
                false,
                null,
                "HTTP context is not available.",
                false);
        }

        var isAuthenticated = httpContext.User.Identity?.IsAuthenticated ?? false;
        var tenantClaimValue = GetTenantClaimValue(httpContext.User);
        var tenantHeaderValue = isAuthenticated
            ? null
            : httpContext.Request.Headers[_options.HeaderName].FirstOrDefault();

        var tenantId = ParseGuid(tenantClaimValue ?? tenantHeaderValue);
        var userId = ParseGuid(
            GetClaimValue(httpContext.User, ClaimTypes.NameIdentifier)
            ?? GetClaimValue(httpContext.User, "sub"));
        var displayName = httpContext.User.Identity?.Name
            ?? GetClaimValue(httpContext.User, ClaimTypes.Name)
            ?? GetClaimValue(httpContext.User, "displayName");
        var role = GetClaimValue(httpContext.User, ClaimTypes.Role) ?? GetClaimValue(httpContext.User, "role");
        var resolutionSource = tenantClaimValue is not null
            ? "claims"
            : !isAuthenticated && httpContext.Request.Headers.ContainsKey(_options.HeaderName)
                ? "header"
                : null;
        var activeDepartmentId = isAuthenticated
            ? ParseGuid(httpContext.Request.Headers["X-Active-Department-Id"].FirstOrDefault())
            : null;

        return new TenantContext(
            tenantId,
            userId,
            displayName,
            role,
            isAuthenticated,
            resolutionSource,
            tenantId is null
                ? isAuthenticated
                    ? "No tenant claim was found on the authenticated principal."
                    : $"No tenant context was found. Provide a tenant claim or the '{_options.HeaderName}' header."
                : null,
            tenantId is not null,
            activeDepartmentId);
    }

    private static Guid? ParseGuid(string? value)
    {
        return Guid.TryParse(value, out var parsed) ? parsed : null;
    }

    private static string? GetClaimValue(ClaimsPrincipal principal, string claimType)
    {
        return principal.FindFirst(claimType)?.Value;
    }

    private static string? GetTenantClaimValue(ClaimsPrincipal principal)
    {
        return GetClaimValue(principal, "tenant_id")
            ?? GetClaimValue(principal, "tenantId")
            ?? GetClaimValue(principal, "tenant");
    }
}