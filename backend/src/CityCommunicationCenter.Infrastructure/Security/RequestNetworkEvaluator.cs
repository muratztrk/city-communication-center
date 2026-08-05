using System.Net;
using CityCommunicationCenter.Application.Abstractions.Identity;
using Microsoft.AspNetCore.Http;

namespace CityCommunicationCenter.Infrastructure.Security;

internal sealed class RequestNetworkEvaluator : IRequestNetworkEvaluator
{
    private const string ForwardedForHeader = "X-Forwarded-For";

    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ITenantAuthenticationPolicyService _tenantAuthenticationPolicyService;

    public RequestNetworkEvaluator(
        IHttpContextAccessor httpContextAccessor,
        ITenantAuthenticationPolicyService tenantAuthenticationPolicyService)
    {
        _httpContextAccessor = httpContextAccessor;
        _tenantAuthenticationPolicyService = tenantAuthenticationPolicyService;
    }

    public async Task<RequestNetworkEvaluation> EvaluateAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var policy = await _tenantAuthenticationPolicyService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return new RequestNetworkEvaluation(null, false);
        }

        var remoteIp = httpContext.Connection.RemoteIpAddress;
        var clientIp = remoteIp;

        if (remoteIp is not null && IpCidrMatcher.IsMatch(remoteIp, policy.TrustedProxyCidrs))
        {
            var forwardedFor = httpContext.Request.Headers[ForwardedForHeader].ToString();
            var forwardedIp = ParseForwardedFor(forwardedFor);
            if (forwardedIp is not null)
            {
                clientIp = forwardedIp;
            }
        }

        var isTrustedNetwork = clientIp is not null && IpCidrMatcher.IsMatch(clientIp, policy.TrustedNetworkCidrs);
        return new RequestNetworkEvaluation(clientIp, isTrustedNetwork);
    }

    private static IPAddress? ParseForwardedFor(string value)
    {
        var candidate = value
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .FirstOrDefault();

        return candidate is not null && IPAddress.TryParse(candidate, out var address)
            ? address
            : null;
    }
}
