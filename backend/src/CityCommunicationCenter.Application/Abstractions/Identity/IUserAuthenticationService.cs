namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface IUserAuthenticationService
{
    Task<AuthenticatedUserDescriptor?> AuthenticateAsync(
        Guid tenantId,
        string username,
        string password,
        CancellationToken cancellationToken = default);

    Task<AuthenticatedUserDescriptor?> AuthenticateTrustedIdentityAsync(
        Guid tenantId,
        string username,
        string authenticationMode,
        CancellationToken cancellationToken = default);
}

public sealed record AuthenticatedUserDescriptor(
    Guid UserId,
    Guid TenantId,
    Guid DepartmentId,
    string? Username,
    string DisplayName,
    string Email,
    string RoleCode,
    IReadOnlyList<string> AdditionalRoleCodes,
    string TenantName,
    string AuthenticationMode);