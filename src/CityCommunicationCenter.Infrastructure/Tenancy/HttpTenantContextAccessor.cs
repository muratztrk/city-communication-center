using System.Security.Claims;
using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Infrastructure.Options;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

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
                "HTTP context is not available.");
        }

        var tenantId = ParseGuid(
            GetClaimValue(httpContext.User, "tenant_id")
            ?? GetClaimValue(httpContext.User, "tenant")
            ?? httpContext.Request.Headers[_options.HeaderName].FirstOrDefault());

        var userId = ParseGuid(GetClaimValue(httpContext.User, ClaimTypes.NameIdentifier));
        var displayName = httpContext.User.Identity?.Name ?? GetClaimValue(httpContext.User, "name");
        var role = GetClaimValue(httpContext.User, ClaimTypes.Role) ?? GetClaimValue(httpContext.User, "role");
        var resolutionSource = httpContext.User.FindFirst("tenant_id") is not null ||
            httpContext.User.FindFirst("tenant") is not null
            ? "claims"
            : httpContext.Request.Headers.ContainsKey(_options.HeaderName)
                ? "header"
                : null;

        return new TenantContext(
            tenantId,
            userId,
            displayName,
            role,
            httpContext.User.Identity?.IsAuthenticated ?? false,
            resolutionSource,
            tenantId is null
                ? $"No tenant context was found. Provide a tenant claim or the '{_options.HeaderName}' header."
                : null);
    }

    private static Guid? ParseGuid(string? value)
    {
        return Guid.TryParse(value, out var parsed) ? parsed : null;
    }

    private static string? GetClaimValue(ClaimsPrincipal principal, string claimType)
    {
        return principal.FindFirst(claimType)?.Value;
    }
}
