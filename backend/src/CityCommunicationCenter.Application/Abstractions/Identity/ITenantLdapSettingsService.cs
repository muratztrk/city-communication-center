namespace CityCommunicationCenter.Application.Abstractions.Identity;

public interface ITenantLdapSettingsService
{
    Task<TenantLdapSettingsDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task<TenantLdapRuntimeSettings> GetRuntimeSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);

    Task SaveSettingsAsync(Guid tenantId, TenantLdapSettingsUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default);
}

public sealed record TenantLdapSettingsDescriptor(
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

public sealed record TenantLdapSettingsUpdate(
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

public sealed record TenantLdapRuntimeSettings(
    bool Enabled,
    string? Host,
    int Port,
    bool UseSsl,
    bool IgnoreCertificateErrors,
    string? Domain,
    string? SearchBase,
    string? BindDn,
    string? BindPassword,
    string UserAttribute,
    bool CanAuthenticate,
    bool CanSearch,
    IReadOnlyList<LdapDirectoryCredential> MockUsers);

public sealed record LdapDirectoryCredential(
    string ExternalIdentityId,
    string Username,
    string DisplayName,
    string? Email,
    string Password);