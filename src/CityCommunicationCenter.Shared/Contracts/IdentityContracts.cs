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
