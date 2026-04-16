namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface ILdapAuthenticationService
{
    Task<LdapAuthenticatedUser?> AuthenticateAsync(Guid tenantId, string username, string password, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LdapDirectoryUser>> SearchUsersAsync(Guid tenantId, string query, CancellationToken cancellationToken = default);

    Task<LdapDirectoryUser?> FindUserByUsernameAsync(Guid tenantId, string username, CancellationToken cancellationToken = default);

    Task<LdapDirectoryUser?> FindUserByExternalIdentityAsync(Guid tenantId, string externalIdentityId, CancellationToken cancellationToken = default);

    Task<LdapConnectivityResult> TestConnectivityAsync(LdapConnectivityTestParameters parameters, CancellationToken cancellationToken = default);
}

public sealed record LdapAuthenticatedUser(string ExternalIdentityId, string Username, string? DisplayName, string? Email);

public sealed record LdapDirectoryUser(string ExternalIdentityId, string Username, string DisplayName, string? Email);

public sealed record LdapConnectivityTestParameters(
    string Host,
    int Port,
    bool UseSsl,
    bool IgnoreCertificateErrors,
    string? Domain,
    string? SearchBase,
    string? BindDn,
    string? BindPassword);

public sealed record LdapConnectivityResult(bool Success, string? Message);