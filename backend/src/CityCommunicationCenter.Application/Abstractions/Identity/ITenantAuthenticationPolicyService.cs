namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface ITenantAuthenticationPolicyService
{
    Task<TenantAuthenticationPolicyDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<TenantAuthenticationPolicyRuntimeSettings> GetRuntimeSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task SaveSettingsAsync(Guid tenantId, TenantAuthenticationPolicyUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default);
}

public sealed record TenantAuthenticationPolicyDescriptor(
    bool AutomaticSignInEnabled,
    string AutomaticSignInMode,
    IReadOnlyList<string> TrustedNetworkCidrs,
    IReadOnlyList<string> TrustedProxyCidrs,
    string? IdentityHeaderName,
    bool RequireSecondFactorOutsideTrustedNetwork,
    string SecondFactorProvider,
    int CodeLength,
    int CodeTtlSeconds,
    bool AllowMockCodePreview,
    string? WebhookUrl,
    bool CanAttemptAutomaticSignIn,
    bool CanIssueSecondFactor);

public sealed record TenantAuthenticationPolicyUpdate(
    bool AutomaticSignInEnabled,
    string AutomaticSignInMode,
    IReadOnlyList<string> TrustedNetworkCidrs,
    IReadOnlyList<string> TrustedProxyCidrs,
    string? IdentityHeaderName,
    bool RequireSecondFactorOutsideTrustedNetwork,
    string SecondFactorProvider,
    int CodeLength,
    int CodeTtlSeconds,
    bool AllowMockCodePreview,
    string? WebhookUrl);

public sealed record TenantAuthenticationPolicyRuntimeSettings(
    bool AutomaticSignInEnabled,
    AutomaticSignInMode AutomaticSignInMode,
    IReadOnlyList<string> TrustedNetworkCidrs,
    IReadOnlyList<string> TrustedProxyCidrs,
    string? IdentityHeaderName,
    bool RequireSecondFactorOutsideTrustedNetwork,
    SecondFactorProviderType SecondFactorProvider,
    int CodeLength,
    int CodeTtlSeconds,
    bool AllowMockCodePreview,
    string? WebhookUrl,
    bool CanAttemptAutomaticSignIn,
    bool CanIssueSecondFactor);