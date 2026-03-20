namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record AuthenticatedTokenPayload(
    Guid UserId,
    Guid TenantId,
    Guid DepartmentId,
    string DisplayName,
    string Email,
    string RoleCode,
    string TenantName,
    string AuthenticationMode);