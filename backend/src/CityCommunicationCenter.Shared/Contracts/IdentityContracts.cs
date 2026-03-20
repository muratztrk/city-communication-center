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
    string DisplayName,
    string? Email,
    string RoleCode,
    bool IsActive);

public sealed record LoginRequest(
    string Username,
    string Password,
    string TenantId);

public sealed record LoginResponse(
    string UserId,
    string DisplayName,
    string Email,
    string Role,
    string TenantId,
    string TenantName,
    string AuthenticationMode);

public sealed record ConnectTokenResponse(
    string access_token,
    string token_type,
    int expires_in);

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
    string DisplayName);

public sealed record BootstrapTenantRequest(
    string MunicipalityName,
    string? DisplayName,
    string AdminDisplayName,
    string AdminEmail,
    string AdminPassword);

public sealed record BootstrapTenantResponse(
    string TenantId,
    string MunicipalityName,
    string DisplayName,
    string AdminDisplayName,
    string AdminEmail,
    string AuthMode);
