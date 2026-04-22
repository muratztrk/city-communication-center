namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CurrentUserResponse(
    Guid? TenantId,
    Guid? UserId,
    string? DisplayName,
    string? RoleCode,
    bool IsAuthenticated,
    string? ResolutionSource);

public sealed record UserSummaryResponse(
    Guid UserId,
    Guid TenantId,
    Guid DepartmentId,
    string? Username,
    string DisplayName,
    string? Email,
    string RoleCode,
    bool IsActive,
    string UserSource,
    string? Title = null,
    string? Phone = null);

public sealed record CreateUserRequest(
    string? Username,
    string DisplayName,
    string? Email,
    string? Password,
    Guid? DepartmentId,
    string RoleCode,
    bool IsActive,
    string SourceType,
    string? ExternalIdentityId,
    string? LdapDepartmentName);

public sealed record UpdateUserRequest(
    Guid DepartmentId,
    string RoleCode,
    bool IsActive);

public sealed record UserLookupResponse(
    Guid UserId,
    Guid DepartmentId,
    string DepartmentName,
    string DisplayName,
    string? Email,
    string RoleCode,
    bool IsActive,
    string UserSource);

public sealed record DirectoryUserLookupResponse(
    string ExternalIdentityId,
    string Username,
    string DisplayName,
    string? Email,
    string? Department,
    bool AlreadyLinked,
    Guid? ExistingUserId,
    string? Title = null,
    string? Phone = null);

public sealed record UserManagementContextResponse(
    bool LocalUsersEnabled,
    bool LdapEnabled);

public sealed record LoginRequest(
    string Username,
    string Password,
    string? TenantId);

public sealed record LoginResponse(
    string UserId,
    string? Username,
    string DisplayName,
    string? Email,
    string Role,
    string TenantId,
    string TenantName,
    string AuthenticationMode);

public sealed record ConnectTokenResponse(
    string access_token,
    string token_type,
    int expires_in);

public sealed record StartInteractiveAuthenticationRequest(
    string? TenantId,
    string? Username,
    string? Password);

public sealed record VerifyInteractiveAuthenticationRequest(
    string? TenantId,
    string ChallengeId,
    string Code);

public sealed record InteractiveAuthenticationGrant(
    string Username,
    string Password);

public sealed record StartInteractiveAuthenticationResponse(
    string Status,
    bool IsTrustedNetwork,
    bool SecondFactorRequiredOnSuccess,
    string? AutomaticSignInMode,
    string? AuthenticationMode,
    string? ChallengeId,
    string? DeliveryDestination,
    string? Message,
    DateTimeOffset? ExpiresAtUtc,
    InteractiveAuthenticationGrant? Grant,
    string? MockCodePreview,
    bool ChallengeWithNegotiate);

public sealed record VerifyInteractiveAuthenticationResponse(
    string Status,
    string? AuthenticationMode,
    string? Message,
    DateTimeOffset? ExpiresAtUtc,
    InteractiveAuthenticationGrant? Grant,
    string? MockCodePreview);

public sealed record AuthenticatedUserProfileResponse(
    string? UserId,
    string? Email,
    string? DisplayName,
    string? Role,
    string? TenantId,
    string? DepartmentId);

public sealed record TenantLookupResponse(
    Guid TenantId,
    string MunicipalityName,
    string DisplayName,
    string DeploymentMode,
    string? Domain);

public sealed record TenantLoginContextResponse(
    IReadOnlyList<TenantLookupResponse> Tenants,
    TenantLookupResponse? ResolvedTenant,
    bool HideTenantSelector,
    bool RequireTenantSelection,
    string ResolutionMode,
    string? Host,
    TenantAppearanceResponse? Appearance);

public sealed record BootstrapTenantRequest(
    string MunicipalityName,
    string? DisplayName,
    string? DeploymentMode,
    string AdminUsername,
    string AdminDisplayName,
    string? AdminEmail,
    string AdminPassword);

public sealed record BootstrapTenantResponse(
    string TenantId,
    string MunicipalityName,
    string DisplayName,
    string DeploymentMode,
    string? Domain,
    string AdminUsername,
    string AdminDisplayName,
    string? AdminEmail,
    string AuthMode);
