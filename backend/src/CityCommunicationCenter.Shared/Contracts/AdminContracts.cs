namespace CityCommunicationCenter.Shared.Contracts;

public sealed record TenantSettingsResponse(
    Guid TenantId,
    string MunicipalityName,
    string DisplayName,
    string DeploymentMode,
    bool IsActive,
    string? Theme,
    string? Domain,
    int DefaultSlaHours);

public sealed record UpdateTenantSettingsRequest(
    string DisplayName,
    string DeploymentMode,
    string? Theme,
    string? Domain,
    int DefaultSlaHours);

public sealed record TenantAppearanceResponse(
    string ThemePreset,
    string PrimaryColor,
    string SecondaryColor,
    string AccentColor,
    string NeutralColor,
    string SurfaceColor,
    string BackgroundColor,
    string HeaderGradientFrom,
    string HeaderGradientTo,
    string SidebarBackgroundColor,
    string SidebarForegroundColor,
    bool IsCustomized);

public sealed record UpdateTenantAppearanceRequest(
    string ThemePreset,
    string PrimaryColor,
    string SecondaryColor,
    string AccentColor,
    string NeutralColor,
    string SurfaceColor,
    string BackgroundColor,
    string HeaderGradientFrom,
    string HeaderGradientTo,
    string SidebarBackgroundColor,
    string SidebarForegroundColor);

public sealed record TenantLdapSettingsResponse(
    bool Enabled,
    string? Host,
    int Port,
    bool UseSsl,
    bool IgnoreCertificateErrors,
    string? Domain,
    string? SearchBase,
    string? BindDn,
    bool HasBindPassword,
    string UserAttribute,
    bool CanAuthenticate,
    bool CanSearch);

public sealed record UpdateTenantLdapSettingsRequest(
    bool Enabled,
    string? Host,
    int Port,
    bool UseSsl,
    bool IgnoreCertificateErrors,
    string? Domain,
    string? SearchBase,
    string? BindDn,
    string? BindPassword,
    bool ClearBindPassword,
    string? UserAttribute);

public sealed record TenantAuthenticationPolicyResponse(
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

public sealed record UpdateTenantAuthenticationPolicyRequest(
    bool AutomaticSignInEnabled,
    string AutomaticSignInMode,
    IReadOnlyList<string>? TrustedNetworkCidrs,
    IReadOnlyList<string>? TrustedProxyCidrs,
    string? IdentityHeaderName,
    bool RequireSecondFactorOutsideTrustedNetwork,
    string SecondFactorProvider,
    int CodeLength,
    int CodeTtlSeconds,
    bool AllowMockCodePreview,
    string? WebhookUrl);

public sealed record PublishWorkflowRequest(
    string WorkflowName,
    int Version,
    string? Description);

public sealed record PublishWorkflowAcceptedResponse(
    string Message,
    string WorkflowName,
    int Version,
    string? Description);

public sealed record AuditLogResponse(
    Guid AuditLogId,
    Guid TenantId,
    string EntityType,
    string EntityId,
    string Action,
    Guid? ActorUserId,
    DateTimeOffset EventTimeUtc,
    string? Details);
