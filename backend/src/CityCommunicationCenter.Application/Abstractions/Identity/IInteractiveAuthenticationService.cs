namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface IInteractiveAuthenticationService
{
    Task<InteractiveAuthenticationStartResult> StartAsync(
        Guid tenantId,
        string? username,
        string? password,
        CancellationToken cancellationToken = default);

    Task<InteractiveAuthenticationVerifyResult> VerifyAsync(
        Guid tenantId,
        string challengeId,
        string code,
        CancellationToken cancellationToken = default);
}

public enum InteractiveAuthenticationStatus
{
    CredentialsRequired,
    SecondFactorRequired,
    ReadyToExchange,
    Failed
}

public enum InteractiveAuthenticationFailureCode
{
    None,
    InvalidTenant,
    InvalidCredentials,
    SecondFactorProviderUnavailable,
    ChallengeNotFound,
    ChallengeExpired,
    InvalidChallengeCode,
    TooManyAttempts
}

public sealed record InteractiveAuthenticationStartResult(
    InteractiveAuthenticationStatus Status,
    bool IsTrustedNetwork,
    bool SecondFactorRequiredOnSuccess,
    string? AutomaticSignInMode,
    string? AuthenticationMode,
    PasswordGrantExchangeCredentials? Grant,
    string? ChallengeId,
    string? DeliveryDestination,
    DateTimeOffset? ExpiresAtUtc,
    string? MockCodePreview,
    InteractiveAuthenticationFailureCode FailureCode,
    bool ShouldChallengeNegotiate = false);

public sealed record InteractiveAuthenticationVerifyResult(
    InteractiveAuthenticationStatus Status,
    string? AuthenticationMode,
    PasswordGrantExchangeCredentials? Grant,
    DateTimeOffset? ExpiresAtUtc,
    string? MockCodePreview,
    InteractiveAuthenticationFailureCode FailureCode);