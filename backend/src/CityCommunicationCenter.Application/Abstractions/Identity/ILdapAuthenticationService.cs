namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface ILdapAuthenticationService
{
    Task<LdapAuthenticatedUser?> AuthenticateAsync(Guid tenantId, string username, string password, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LdapDirectoryUser>> SearchUsersAsync(Guid tenantId, string query, CancellationToken cancellationToken = default);

    /// <summary>LDAP'tan ayırt edici birim adlarını listeler (yalnız physicalDeliveryOfficeName attribute — card #1838). Senkron otomatik oluşturmaz.</summary>
    Task<IReadOnlyList<string>> ListDepartmentNamesAsync(Guid tenantId, CancellationToken cancellationToken = default);

    /// <summary>LDAP'taki kullanıcı hesaplarını önek taramasıyla listeler (toplu ekleme). Otomatik kullanıcı oluşturmaz.</summary>
    Task<IReadOnlyList<LdapDirectoryUser>> ListUsersAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<LdapDirectoryUser?> FindUserByUsernameAsync(Guid tenantId, string username, CancellationToken cancellationToken = default);

    Task<LdapDirectoryUser?> FindUserByExternalIdentityAsync(Guid tenantId, string externalIdentityId, CancellationToken cancellationToken = default);

    Task<LdapConnectivityResult> TestConnectivityAsync(LdapConnectivityTestParameters parameters, CancellationToken cancellationToken = default);
}

public sealed record LdapAuthenticatedUser(string ExternalIdentityId, string Username, string? DisplayName, string? Email, string? Title = null, string? Phone = null);

/// <param name="Department">yalnız physicalDeliveryOfficeName attribute (department/OU değil — card #1838).</param>
/// <param name="OrganizationalUnit">DN'den çıkarılan OU (card #1764).</param>
public sealed record LdapDirectoryUser(
    string ExternalIdentityId,
    string Username,
    string DisplayName,
    string? Email,
    string? Department,
    string? Title = null,
    string? Phone = null,
    string? OrganizationalUnit = null);

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