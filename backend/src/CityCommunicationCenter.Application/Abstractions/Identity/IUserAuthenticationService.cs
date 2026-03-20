namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface IUserAuthenticationService
{
    Task<AuthenticatedUserDescriptor?> AuthenticateAsync(
        Guid tenantId,
        string username,
        string password,
        CancellationToken cancellationToken = default);
}

public sealed record AuthenticatedUserDescriptor(
    Guid UserId,
    Guid TenantId,
    Guid DepartmentId,
    string DisplayName,
    string Email,
    string RoleCode,
    string TenantName,
    string AuthenticationMode);