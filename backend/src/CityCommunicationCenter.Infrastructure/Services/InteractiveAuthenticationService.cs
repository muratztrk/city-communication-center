using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class InteractiveAuthenticationService : IInteractiveAuthenticationService
{
    private const string NegotiateScheme = "Negotiate";
    private const string ForwardedForHeader = "X-Forwarded-For";
    private const string ChallengePrefix = "auth-challenge:";
    private const int MaxChallengeAttempts = 5;

    private readonly IUserAuthenticationService _userAuthenticationService;
    private readonly IAuthenticationExchangeTicketService _authenticationExchangeTicketService;
    private readonly ITenantAuthenticationPolicyService _tenantAuthenticationPolicyService;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMemoryCache _memoryCache;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<InteractiveAuthenticationService> _logger;

    public InteractiveAuthenticationService(
        IUserAuthenticationService userAuthenticationService,
        IAuthenticationExchangeTicketService authenticationExchangeTicketService,
        ITenantAuthenticationPolicyService tenantAuthenticationPolicyService,
        IHttpContextAccessor httpContextAccessor,
        IMemoryCache memoryCache,
        IHttpClientFactory httpClientFactory,
        IWebHostEnvironment environment,
        ILogger<InteractiveAuthenticationService> logger)
    {
        _userAuthenticationService = userAuthenticationService;
        _authenticationExchangeTicketService = authenticationExchangeTicketService;
        _tenantAuthenticationPolicyService = tenantAuthenticationPolicyService;
        _httpContextAccessor = httpContextAccessor;
        _memoryCache = memoryCache;
        _httpClientFactory = httpClientFactory;
        _environment = environment;
        _logger = logger;
    }

    public async Task<InteractiveAuthenticationStartResult> StartAsync(
        Guid tenantId,
        string? username,
        string? password,
        CancellationToken cancellationToken = default)
    {
        var httpContext = _httpContextAccessor.HttpContext
            ?? throw new InvalidOperationException("HTTP context is required for interactive authentication.");

        var policy = await _tenantAuthenticationPolicyService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        var network = ResolveNetwork(httpContext, policy);
        var automaticMode = policy.CanAttemptAutomaticSignIn ? policy.AutomaticSignInMode.ToString() : null;

        if (string.IsNullOrWhiteSpace(username) && string.IsNullOrWhiteSpace(password))
        {
            if (network.IsTrustedNetwork && policy.CanAttemptAutomaticSignIn)
            {
                var automaticSignIn = await TryStartAutomaticAuthenticationAsync(httpContext, tenantId, policy, cancellationToken);
                if (automaticSignIn is not null)
                {
                    return automaticSignIn with
                    {
                        IsTrustedNetwork = true,
                        AutomaticSignInMode = automaticMode,
                        SecondFactorRequiredOnSuccess = false,
                    };
                }
            }

            return new InteractiveAuthenticationStartResult(
                InteractiveAuthenticationStatus.CredentialsRequired,
                network.IsTrustedNetwork,
                !network.IsTrustedNetwork && policy.RequireSecondFactorOutsideTrustedNetwork,
                automaticMode,
                null,
                null,
                null,
                null,
                null,
                null,
                InteractiveAuthenticationFailureCode.None);
        }

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return new InteractiveAuthenticationStartResult(
                InteractiveAuthenticationStatus.Failed,
                network.IsTrustedNetwork,
                !network.IsTrustedNetwork && policy.RequireSecondFactorOutsideTrustedNetwork,
                automaticMode,
                null,
                null,
                null,
                null,
                null,
                null,
                InteractiveAuthenticationFailureCode.InvalidCredentials);
        }

        var authenticatedUser = await _userAuthenticationService.AuthenticateAsync(tenantId, username.Trim(), password, cancellationToken);
        if (authenticatedUser is null)
        {
            return new InteractiveAuthenticationStartResult(
                InteractiveAuthenticationStatus.Failed,
                network.IsTrustedNetwork,
                !network.IsTrustedNetwork && policy.RequireSecondFactorOutsideTrustedNetwork,
                automaticMode,
                null,
                null,
                null,
                null,
                null,
                null,
                InteractiveAuthenticationFailureCode.InvalidCredentials);
        }

        if (!network.IsTrustedNetwork && policy.RequireSecondFactorOutsideTrustedNetwork)
        {
            if (!policy.CanIssueSecondFactor)
            {
                return new InteractiveAuthenticationStartResult(
                    InteractiveAuthenticationStatus.Failed,
                    false,
                    true,
                    automaticMode,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    InteractiveAuthenticationFailureCode.SecondFactorProviderUnavailable);
            }

            return await CreateSecondFactorChallengeAsync(tenantId, authenticatedUser, policy, automaticMode, cancellationToken);
        }

        var grant = await _authenticationExchangeTicketService.CreateAsync(tenantId, authenticatedUser.UserId, authenticatedUser.AuthenticationMode, cancellationToken);
        return new InteractiveAuthenticationStartResult(
            InteractiveAuthenticationStatus.ReadyToExchange,
            network.IsTrustedNetwork,
            false,
            automaticMode,
            authenticatedUser.AuthenticationMode,
            grant,
            null,
            null,
            null,
            null,
            InteractiveAuthenticationFailureCode.None);
    }

    public async Task<InteractiveAuthenticationVerifyResult> VerifyAsync(
        Guid tenantId,
        string challengeId,
        string code,
        CancellationToken cancellationToken = default)
    {
        if (!_memoryCache.TryGetValue<PendingSecondFactorChallenge>(challengeId, out var challenge) || challenge is null || challenge.TenantId != tenantId)
        {
            return new InteractiveAuthenticationVerifyResult(
                InteractiveAuthenticationStatus.Failed,
                null,
                null,
                null,
                null,
                InteractiveAuthenticationFailureCode.ChallengeNotFound);
        }

        if (challenge.ExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            _memoryCache.Remove(challengeId);
            return new InteractiveAuthenticationVerifyResult(
                InteractiveAuthenticationStatus.Failed,
                null,
                null,
                null,
                null,
                InteractiveAuthenticationFailureCode.ChallengeExpired);
        }

        if (!VerifySecret(code.Trim(), challenge.CodeHash))
        {
            challenge.RemainingAttempts -= 1;
            if (challenge.RemainingAttempts <= 0)
            {
                _memoryCache.Remove(challengeId);
                return new InteractiveAuthenticationVerifyResult(
                    InteractiveAuthenticationStatus.Failed,
                    null,
                    null,
                    null,
                    null,
                    InteractiveAuthenticationFailureCode.TooManyAttempts);
            }

            _memoryCache.Set(challengeId, challenge, challenge.ExpiresAtUtc);
            return new InteractiveAuthenticationVerifyResult(
                InteractiveAuthenticationStatus.Failed,
                null,
                null,
                null,
                null,
                InteractiveAuthenticationFailureCode.InvalidChallengeCode);
        }

        _memoryCache.Remove(challengeId);

        var authenticationMode = challenge.AuthenticationMode.Contains("SecondFactor", StringComparison.OrdinalIgnoreCase)
            ? challenge.AuthenticationMode
            : challenge.AuthenticationMode + "+SecondFactor";
        var grant = await _authenticationExchangeTicketService.CreateAsync(tenantId, challenge.UserId, authenticationMode, cancellationToken);

        return new InteractiveAuthenticationVerifyResult(
            InteractiveAuthenticationStatus.ReadyToExchange,
            authenticationMode,
            grant,
            null,
            null,
            InteractiveAuthenticationFailureCode.None);
    }

    private async Task<InteractiveAuthenticationStartResult?> TryStartAutomaticAuthenticationAsync(
        HttpContext httpContext,
        Guid tenantId,
        TenantAuthenticationPolicyRuntimeSettings policy,
        CancellationToken cancellationToken)
    {
        var identity = policy.AutomaticSignInMode switch
        {
            AutomaticSignInMode.TrustedHeader => ReadTrustedIdentityHeader(httpContext, policy.IdentityHeaderName),
            AutomaticSignInMode.Negotiate => await ReadNegotiateIdentityAsync(httpContext),
            _ => null,
        };

        if (identity is null)
        {
            return policy.AutomaticSignInMode == AutomaticSignInMode.Negotiate
                ? new InteractiveAuthenticationStartResult(
                    InteractiveAuthenticationStatus.CredentialsRequired,
                    true,
                    false,
                    AutomaticSignInMode.Negotiate.ToString(),
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    InteractiveAuthenticationFailureCode.None,
                    true)
                : null;
        }

        var authenticationMode = policy.AutomaticSignInMode == AutomaticSignInMode.Negotiate
            ? "NegotiateSso"
            : "TrustedHeaderSso";
        var authenticatedUser = await _userAuthenticationService.AuthenticateTrustedIdentityAsync(tenantId, identity, authenticationMode, cancellationToken);
        if (authenticatedUser is null)
        {
            return null;
        }

        var grant = await _authenticationExchangeTicketService.CreateAsync(tenantId, authenticatedUser.UserId, authenticatedUser.AuthenticationMode, cancellationToken);
        return new InteractiveAuthenticationStartResult(
            InteractiveAuthenticationStatus.ReadyToExchange,
            true,
            false,
            policy.AutomaticSignInMode.ToString(),
            authenticatedUser.AuthenticationMode,
            grant,
            null,
            null,
            null,
            null,
            InteractiveAuthenticationFailureCode.None);
    }

    private async Task<InteractiveAuthenticationStartResult> CreateSecondFactorChallengeAsync(
        Guid tenantId,
        AuthenticatedUserDescriptor authenticatedUser,
        TenantAuthenticationPolicyRuntimeSettings policy,
        string? automaticMode,
        CancellationToken cancellationToken)
    {
        var challengeId = ChallengePrefix + Guid.NewGuid().ToString("N");
        var code = GenerateCode(policy.CodeLength);
        var expiresAtUtc = DateTimeOffset.UtcNow.AddSeconds(policy.CodeTtlSeconds);
        var deliveryDestination = ResolveDeliveryDestination(authenticatedUser);
        var mockCodePreview = _environment.IsDevelopment() && policy.AllowMockCodePreview ? code : null;

        if (!await DispatchSecondFactorAsync(challengeId, code, authenticatedUser, deliveryDestination, expiresAtUtc, policy, cancellationToken))
        {
            return new InteractiveAuthenticationStartResult(
                InteractiveAuthenticationStatus.Failed,
                false,
                true,
                automaticMode,
                null,
                null,
                null,
                null,
                null,
                null,
                InteractiveAuthenticationFailureCode.SecondFactorProviderUnavailable);
        }

        _memoryCache.Set(
            challengeId,
            new PendingSecondFactorChallenge(
                tenantId,
                authenticatedUser.UserId,
                authenticatedUser.AuthenticationMode,
                HashSecret(code),
                expiresAtUtc,
                MaxChallengeAttempts),
            expiresAtUtc);

        return new InteractiveAuthenticationStartResult(
            InteractiveAuthenticationStatus.SecondFactorRequired,
            false,
            true,
            automaticMode,
            authenticatedUser.AuthenticationMode,
            null,
            challengeId,
            deliveryDestination,
            expiresAtUtc,
            mockCodePreview,
            InteractiveAuthenticationFailureCode.None);
    }

    private async Task<bool> DispatchSecondFactorAsync(
        string challengeId,
        string code,
        AuthenticatedUserDescriptor authenticatedUser,
        string deliveryDestination,
        DateTimeOffset expiresAtUtc,
        TenantAuthenticationPolicyRuntimeSettings policy,
        CancellationToken cancellationToken)
    {
        switch (policy.SecondFactorProvider)
        {
            case SecondFactorProviderType.Mock:
                _logger.LogDebug(
                    "Mock second factor dispatched for tenant {TenantId}, user {UserId}, challenge {ChallengeId}",
                    authenticatedUser.TenantId,
                    authenticatedUser.UserId,
                    challengeId);
                return true;

            case SecondFactorProviderType.Webhook when !string.IsNullOrWhiteSpace(policy.WebhookUrl):
                try
                {
                    var client = _httpClientFactory.CreateClient(nameof(InteractiveAuthenticationService));
                    var response = await client.PostAsJsonAsync(
                        policy.WebhookUrl,
                        new
                        {
                            challengeId,
                            tenantId = authenticatedUser.TenantId,
                            userId = authenticatedUser.UserId,
                            username = authenticatedUser.Username,
                            displayName = authenticatedUser.DisplayName,
                            email = authenticatedUser.Email,
                            deliveryDestination,
                            code,
                            expiresAtUtc,
                            authenticationMode = authenticatedUser.AuthenticationMode,
                        },
                        cancellationToken);

                    if (response.IsSuccessStatusCode)
                    {
                        return true;
                    }

                    _logger.LogWarning(
                        "Second factor webhook provider returned status {StatusCode} for challenge {ChallengeId}",
                        response.StatusCode,
                        challengeId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Second factor webhook provider failed for challenge {ChallengeId}", challengeId);
                }

                return false;

            default:
                return false;
        }
    }

    private static RequestNetworkResolution ResolveNetwork(HttpContext httpContext, TenantAuthenticationPolicyRuntimeSettings policy)
    {
        var remoteIp = httpContext.Connection.RemoteIpAddress;
        var clientIp = remoteIp;

        if (remoteIp is not null && IsMatch(remoteIp, policy.TrustedProxyCidrs))
        {
            var forwardedFor = httpContext.Request.Headers[ForwardedForHeader].ToString();
            var forwardedIp = ParseForwardedFor(forwardedFor);
            if (forwardedIp is not null)
            {
                clientIp = forwardedIp;
            }
        }

        return new RequestNetworkResolution(clientIp, clientIp is not null && IsMatch(clientIp, policy.TrustedNetworkCidrs));
    }

    private static string? ReadTrustedIdentityHeader(HttpContext httpContext, string? headerName)
    {
        if (string.IsNullOrWhiteSpace(headerName))
        {
            return null;
        }

        var headerValue = httpContext.Request.Headers[headerName].ToString();
        return NormalizeIdentity(headerValue);
    }

    private static async Task<string?> ReadNegotiateIdentityAsync(HttpContext httpContext)
    {
        var result = await httpContext.AuthenticateAsync(NegotiateScheme);
        if (!result.Succeeded || result.Principal?.Identity?.IsAuthenticated != true)
        {
            return null;
        }

        return NormalizeIdentity(result.Principal.Identity.Name);
    }

    private static string? NormalizeIdentity(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        var slashIndex = normalized.LastIndexOf('\\');
        if (slashIndex >= 0 && slashIndex < normalized.Length - 1)
        {
            normalized = normalized[(slashIndex + 1)..];
        }

        return normalized;
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

    private static bool IsMatch(IPAddress address, IReadOnlyList<string> cidrs)
    {
        return cidrs.Any(cidr => IpCidrRange.TryParse(cidr, out var range) && range.Contains(address));
    }

    private static string ResolveDeliveryDestination(AuthenticatedUserDescriptor authenticatedUser)
    {
        if (!string.IsNullOrWhiteSpace(authenticatedUser.Email))
        {
            return authenticatedUser.Email;
        }

        if (!string.IsNullOrWhiteSpace(authenticatedUser.Username))
        {
            return authenticatedUser.Username;
        }

        return authenticatedUser.DisplayName;
    }

    private static string GenerateCode(int length)
    {
        var digits = new char[length];
        for (var index = 0; index < digits.Length; index += 1)
        {
            digits[index] = (char)('0' + RandomNumberGenerator.GetInt32(0, 10));
        }

        return new string(digits);
    }

    private static byte[] HashSecret(string value)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(value));
    }

    private static bool VerifySecret(string value, byte[] expectedHash)
    {
        var actualHash = SHA256.HashData(Encoding.UTF8.GetBytes(value));
        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    private sealed record RequestNetworkResolution(IPAddress? ClientIp, bool IsTrustedNetwork);

    private sealed class PendingSecondFactorChallenge
    {
        public PendingSecondFactorChallenge(
            Guid tenantId,
            Guid userId,
            string authenticationMode,
            byte[] codeHash,
            DateTimeOffset expiresAtUtc,
            int remainingAttempts)
        {
            TenantId = tenantId;
            UserId = userId;
            AuthenticationMode = authenticationMode;
            CodeHash = codeHash;
            ExpiresAtUtc = expiresAtUtc;
            RemainingAttempts = remainingAttempts;
        }

        public Guid TenantId { get; }

        public Guid UserId { get; }

        public string AuthenticationMode { get; }

        public byte[] CodeHash { get; }

        public DateTimeOffset ExpiresAtUtc { get; }

        public int RemainingAttempts { get; set; }
    }

    private sealed class IpCidrRange
    {
        private readonly byte[] _networkBytes;

        private IpCidrRange(IPAddress networkAddress, int prefixLength)
        {
            NetworkAddress = networkAddress;
            PrefixLength = prefixLength;
            _networkBytes = networkAddress.GetAddressBytes();
        }

        public IPAddress NetworkAddress { get; }

        public int PrefixLength { get; }

        public bool Contains(IPAddress address)
        {
            var networkAddress = NetworkAddress.IsIPv4MappedToIPv6 ? NetworkAddress.MapToIPv4() : NetworkAddress;
            var candidateAddress = address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
            var networkBytes = networkAddress.GetAddressBytes();
            var addressBytes = candidateAddress.GetAddressBytes();
            if (addressBytes.Length != networkBytes.Length)
            {
                return false;
            }

            var fullBytes = PrefixLength / 8;
            var remainingBits = PrefixLength % 8;

            for (var index = 0; index < fullBytes; index += 1)
            {
                if (networkBytes[index] != addressBytes[index])
                {
                    return false;
                }
            }

            if (remainingBits == 0)
            {
                return true;
            }

            var mask = (byte)(byte.MaxValue << (8 - remainingBits));
            return (networkBytes[fullBytes] & mask) == (addressBytes[fullBytes] & mask);
        }

        public static bool TryParse(string value, out IpCidrRange range)
        {
            range = null!;
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            var parts = value.Split('/', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (!IPAddress.TryParse(parts[0], out var networkAddress))
            {
                return false;
            }

            var maxPrefixLength = networkAddress.GetAddressBytes().Length * 8;
            var prefixLength = maxPrefixLength;
            if (parts.Length == 2 && (!int.TryParse(parts[1], out prefixLength) || prefixLength < 0 || prefixLength > maxPrefixLength))
            {
                return false;
            }

            range = new IpCidrRange(networkAddress, prefixLength);
            return true;
        }
    }
}
