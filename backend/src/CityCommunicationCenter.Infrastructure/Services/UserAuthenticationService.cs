using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Options;
using CityCommunicationCenter.Infrastructure.Persistence;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class UserAuthenticationService : IUserAuthenticationService, IAuthenticationModeProvider, IUserManagementConfigurationProvider
{
    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly AuthenticationOptions _options;
    private readonly IAuthenticationExchangeTicketService _authenticationExchangeTicketService;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly ILocalUserPasswordService _localUserPasswordService;

    public UserAuthenticationService(
        CityCommunicationCenterDbContext dbContext,
        IOptions<AuthenticationOptions> options,
        IAuthenticationExchangeTicketService authenticationExchangeTicketService,
        ILdapAuthenticationService ldapAuthenticationService,
        ITenantLdapSettingsService tenantLdapSettingsService,
        ILocalUserPasswordService localUserPasswordService)
    {
        _dbContext = dbContext;
        _options = options.Value;
        _authenticationExchangeTicketService = authenticationExchangeTicketService;
        _ldapAuthenticationService = ldapAuthenticationService;
        _tenantLdapSettingsService = tenantLdapSettingsService;
        _localUserPasswordService = localUserPasswordService;
    }

    public async Task<AuthenticatedUserDescriptor?> AuthenticateAsync(
        Guid tenantId,
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        var exchangedUser = await _authenticationExchangeTicketService.ConsumeAsync(tenantId, username, password, cancellationToken);
        if (exchangedUser is not null)
        {
            return exchangedUser;
        }

        var tenant = await _dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.IsActive, cancellationToken);

        if (tenant is null)
        {
            return null;
        }

        var localUser = await FindLocalUserAsync(tenantId, username, cancellationToken);
        if (localUser is not null)
        {
            if (!localUser.IsActive)
            {
                return null;
            }

            var localAuthentication = AuthenticateLocalUser(localUser, tenant.DisplayName, password);
            if (localAuthentication is not null)
            {
                return localAuthentication;
            }
        }

        var linkedLdapUser = await FindExistingLdapUserAsync(tenantId, username, cancellationToken);
        if (linkedLdapUser is null)
        {
            return await AuthenticateLinkedLdapUserAsync(tenantId, tenant.DisplayName, username, password, cancellationToken);
        }

        if (!linkedLdapUser.IsActive)
        {
            return null;
        }

        var ldapUser = await _ldapAuthenticationService.AuthenticateAsync(tenantId, username, password, cancellationToken);
        if (ldapUser is null || !MatchesLinkedLdapUser(linkedLdapUser, ldapUser))
        {
            return null;
        }

        SyncLdapProfile(linkedLdapUser, ldapUser);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return ToDescriptor(linkedLdapUser, tenant.DisplayName, "Ldap");
    }

    public async Task<AuthenticatedUserDescriptor?> AuthenticateTrustedIdentityAsync(
        Guid tenantId,
        string username,
        string authenticationMode,
        CancellationToken cancellationToken = default)
    {
        var tenant = await _dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.IsActive, cancellationToken);

        if (tenant is null || string.IsNullOrWhiteSpace(username))
        {
            return null;
        }

        var matchedUser = await FindExistingUserByIdentityAsync(tenantId, username.Trim(), cancellationToken);
        if (matchedUser is not null)
        {
            return matchedUser.IsActive
                ? ToDescriptor(matchedUser, tenant.DisplayName, authenticationMode)
                : null;
        }

        return null;
    }

    public string GetBootstrapAuthMode()
    {
        return "LocalUser";
    }

    public async Task<UserManagementConfiguration> GetConfigurationAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var ldapSettings = await _tenantLdapSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        return new UserManagementConfiguration(_options.EnableLocalUsers, ldapSettings.CanSearch);
    }

    private async Task<ApplicationUser?> FindLocalUserAsync(Guid tenantId, string username, CancellationToken cancellationToken)
    {
        var normalizedUsername = username.Trim();
        if (string.IsNullOrWhiteSpace(normalizedUsername))
        {
            return null;
        }

        var lowered = normalizedUsername.ToLowerInvariant();

        return await _dbContext.Users
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId && entity.UserSource == UserSource.Manual)
            .FirstOrDefaultAsync(
                entity => entity.Username!.ToLower() == lowered
                       || entity.Email!.ToLower() == lowered,
                cancellationToken);
    }

    private async Task<ApplicationUser?> FindExistingLdapUserAsync(Guid tenantId, string username, CancellationToken cancellationToken)
    {
        var normalizedUsername = username.Trim();
        if (string.IsNullOrWhiteSpace(normalizedUsername))
        {
            return null;
        }

        return await _dbContext.Users
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId && entity.UserSource == UserSource.Ldap)
            .FirstOrDefaultAsync(
                entity => EF.Functions.ILike(entity.Username ?? string.Empty, normalizedUsername) ||
                          EF.Functions.ILike(entity.Email ?? string.Empty, normalizedUsername) ||
                          EF.Functions.ILike(entity.ExternalIdentityId ?? string.Empty, normalizedUsername),
                cancellationToken);
    }

    private async Task<ApplicationUser?> FindExistingUserByIdentityAsync(Guid tenantId, string username, CancellationToken cancellationToken)
    {
        var normalizedUsername = username.Trim();
        if (string.IsNullOrWhiteSpace(normalizedUsername))
        {
            return null;
        }

        return await _dbContext.Users
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .FirstOrDefaultAsync(
                entity => EF.Functions.ILike(entity.Username ?? string.Empty, normalizedUsername) ||
                          EF.Functions.ILike(entity.Email ?? string.Empty, normalizedUsername) ||
                          EF.Functions.ILike(entity.ExternalIdentityId ?? string.Empty, normalizedUsername),
                cancellationToken);
    }

    private Task<ApplicationUser?> FindLinkedLdapUserAsync(
        Guid tenantId,
        LdapAuthenticatedUser ldapUser,
        CancellationToken cancellationToken)
    {
        var normalizedExternalIdentityId = ldapUser.ExternalIdentityId.ToUpperInvariant();
        var normalizedUsername = ldapUser.Username.ToUpperInvariant();
        var normalizedEmail = string.IsNullOrWhiteSpace(ldapUser.Email)
            ? null
            : ldapUser.Email.ToUpperInvariant();

        return _dbContext.Users
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId && entity.UserSource == UserSource.Ldap)
            .FirstOrDefaultAsync(
                entity =>
                    (entity.ExternalIdentityId != null && entity.ExternalIdentityId.ToUpper() == normalizedExternalIdentityId) ||
                    (entity.Username != null && entity.Username.ToUpper() == normalizedUsername) ||
                    (normalizedEmail != null && entity.Email != null && entity.Email.ToUpper() == normalizedEmail),
                cancellationToken);
    }

    private AuthenticatedUserDescriptor? AuthenticateLocalUser(ApplicationUser user, string tenantDisplayName, string password)
    {
        if (!_options.EnableLocalUsers || string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            return null;
        }

        return _localUserPasswordService.VerifyPassword(user, password)
            ? ToDescriptor(user, tenantDisplayName, "LocalUser")
            : null;
    }

    private async Task<AuthenticatedUserDescriptor?> AuthenticateLinkedLdapUserAsync(
        Guid tenantId,
        string tenantDisplayName,
        string username,
        string password,
        CancellationToken cancellationToken)
    {
        var ldapUser = await _ldapAuthenticationService.AuthenticateAsync(tenantId, username, password, cancellationToken);
        if (ldapUser is null)
        {
            return null;
        }

        var linkedUser = await FindLinkedLdapUserAsync(tenantId, ldapUser, cancellationToken);
        if (linkedUser is null || !linkedUser.IsActive)
        {
            return null;
        }

        SyncLdapProfile(linkedUser, ldapUser);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return ToDescriptor(linkedUser, tenantDisplayName, "Ldap");
    }

    private static bool MatchesLinkedLdapUser(ApplicationUser user, LdapAuthenticatedUser ldapUser)
    {
        if (!string.IsNullOrWhiteSpace(user.ExternalIdentityId) && string.Equals(user.ExternalIdentityId, ldapUser.ExternalIdentityId, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(user.Username) && string.Equals(user.Username, ldapUser.Username, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return !string.IsNullOrWhiteSpace(user.Email)
            && !string.IsNullOrWhiteSpace(ldapUser.Email)
            && string.Equals(user.Email, ldapUser.Email, StringComparison.OrdinalIgnoreCase);
    }

    private static void SyncLdapProfile(ApplicationUser user, LdapAuthenticatedUser ldapUser)
    {
        user.UserSource = UserSource.Ldap;
        user.Username = ldapUser.Username;
        user.ExternalIdentityId = ldapUser.ExternalIdentityId;
        user.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (!string.IsNullOrWhiteSpace(ldapUser.Email))
        {
            user.Email = ldapUser.Email;
        }

        if (!string.IsNullOrWhiteSpace(ldapUser.DisplayName))
        {
            user.DisplayName = ldapUser.DisplayName;
        }

        if (!string.IsNullOrWhiteSpace(ldapUser.Title))
        {
            user.Title = ldapUser.Title;
        }

        if (!string.IsNullOrWhiteSpace(ldapUser.Phone))
        {
            user.Phone = ldapUser.Phone;
        }
    }

    private static AuthenticatedUserDescriptor ToDescriptor(ApplicationUser user, string tenantName, string authenticationMode)
    {
        return new AuthenticatedUserDescriptor(
            user.UserId,
            user.TenantId,
            user.DepartmentId,
            user.Username,
            user.DisplayName,
            user.Email ?? string.Empty,
            user.RoleCode.ToString(),
            tenantName,
            authenticationMode);
    }
}