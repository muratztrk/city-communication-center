using System.DirectoryServices.Protocols;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class LdapAuthenticationService : ILdapAuthenticationService
{
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly ILogger<LdapAuthenticationService> _logger;
    private readonly int _searchResultLimit;

    public LdapAuthenticationService(ITenantLdapSettingsService tenantLdapSettingsService, IOptions<AuthenticationOptions> options, ILogger<LdapAuthenticationService> logger)
    {
        _tenantLdapSettingsService = tenantLdapSettingsService;
        _logger = logger;
        _searchResultLimit = Math.Clamp(options.Value.Ldap.SearchResultLimit, 1, 50);
    }

    public async Task<LdapAuthenticatedUser?> AuthenticateAsync(Guid tenantId, string username, string password, CancellationToken cancellationToken = default)
    {
        var settings = await _tenantLdapSettingsService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!settings.CanAuthenticate || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        if (settings.MockUsers.Count > 0 && string.IsNullOrWhiteSpace(settings.Host))
        {
            var mockUser = settings.MockUsers.FirstOrDefault(candidate =>
                string.Equals(candidate.Username, username, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(candidate.Email, username, StringComparison.OrdinalIgnoreCase));

            if (mockUser is null || !string.Equals(mockUser.Password, password, StringComparison.Ordinal))
            {
                return null;
            }

            return new LdapAuthenticatedUser(
                mockUser.ExternalIdentityId,
                mockUser.Username,
                string.IsNullOrWhiteSpace(mockUser.DisplayName) ? mockUser.Username : mockUser.DisplayName,
                mockUser.Email);
        }

        return await Task.Run(() => AuthenticateInternal(settings, username, password), cancellationToken);
    }

    public async Task<IReadOnlyList<LdapDirectoryUser>> SearchUsersAsync(Guid tenantId, string query, CancellationToken cancellationToken = default)
    {
        var settings = await _tenantLdapSettingsService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!settings.CanSearch || string.IsNullOrWhiteSpace(query))
        {
            return [];
        }

        if (settings.MockUsers.Count > 0 && string.IsNullOrWhiteSpace(settings.Host))
        {
            var normalizedQuery = query.Trim();
            IReadOnlyList<LdapDirectoryUser> results = settings.MockUsers
                .Where(candidate =>
                    candidate.Username.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                    candidate.DisplayName.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase) ||
                    (candidate.Email?.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase) ?? false))
                .OrderBy(candidate => candidate.DisplayName)
                .Take(GetSearchResultLimit())
                .Select(candidate => new LdapDirectoryUser(
                    candidate.ExternalIdentityId,
                    candidate.Username,
                    candidate.DisplayName,
                    candidate.Email,
                    null))
                .ToArray();

            return results;
        }

        return await Task.Run(() => SearchUsersInternal(settings, query), cancellationToken);
    }

    public async Task<LdapDirectoryUser?> FindUserByUsernameAsync(Guid tenantId, string username, CancellationToken cancellationToken = default)
    {
        var settings = await _tenantLdapSettingsService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!settings.CanSearch || string.IsNullOrWhiteSpace(username))
        {
            return null;
        }

        if (settings.MockUsers.Count > 0 && string.IsNullOrWhiteSpace(settings.Host))
        {
            var mockUser = settings.MockUsers.FirstOrDefault(candidate =>
                string.Equals(candidate.Username, username, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(candidate.Email, username, StringComparison.OrdinalIgnoreCase));

            return mockUser is null
                ? null
                : new LdapDirectoryUser(mockUser.ExternalIdentityId, mockUser.Username, mockUser.DisplayName, mockUser.Email, null);
        }

        return await Task.Run(() => FindUserByUsernameInternal(settings, username), cancellationToken);
    }

    public async Task<LdapDirectoryUser?> FindUserByExternalIdentityAsync(Guid tenantId, string externalIdentityId, CancellationToken cancellationToken = default)
    {
        var settings = await _tenantLdapSettingsService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!settings.CanSearch || string.IsNullOrWhiteSpace(externalIdentityId))
        {
            return null;
        }

        if (settings.MockUsers.Count > 0 && string.IsNullOrWhiteSpace(settings.Host))
        {
            var mockUser = settings.MockUsers.FirstOrDefault(candidate => string.Equals(candidate.ExternalIdentityId, externalIdentityId, StringComparison.OrdinalIgnoreCase));
            return mockUser is null
                ? null
                : new LdapDirectoryUser(mockUser.ExternalIdentityId, mockUser.Username, mockUser.DisplayName, mockUser.Email, null);
        }

        return await Task.Run(() => FindUserByExternalIdentityInternal(settings, externalIdentityId), cancellationToken);
    }

    private LdapAuthenticatedUser? AuthenticateInternal(TenantLdapRuntimeSettings settings, string username, string password)
    {
        var identifier = new LdapDirectoryIdentifier(settings.Host, settings.Port);

        var userDn = FindUserDistinguishedName(settings, identifier, username) ?? BuildBindUsername(settings, username);
        using var connection = CreateConnection(settings, identifier);

        try
        {
            connection.Bind(new NetworkCredential(userDn, password));
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP bind failed during authentication for user {Username}", username);
            return null;
        }

        var profile = FindUserProfile(settings, identifier, username) ?? new LdapAuthenticatedUser(username, username, username, NormalizeEmail(username));
        return profile with { ExternalIdentityId = string.IsNullOrWhiteSpace(profile.ExternalIdentityId) ? username : profile.ExternalIdentityId };
    }

    private IReadOnlyList<LdapDirectoryUser> SearchUsersInternal(TenantLdapRuntimeSettings settings, string query)
    {
        if (!settings.CanSearch || string.IsNullOrWhiteSpace(settings.Host))
        {
            return [];
        }

        var identifier = new LdapDirectoryIdentifier(settings.Host, settings.Port);
        using var connection = CreateConnection(settings, identifier);

        try
        {
            connection.Bind(new NetworkCredential(settings.BindDn, settings.BindPassword));
            var escapedQuery = Escape(query.Trim());
            var request = new SearchRequest(
                settings.SearchBase,
                $"(|({settings.UserAttribute}=*{escapedQuery}*)(sAMAccountName=*{escapedQuery}*)(userPrincipalName=*{escapedQuery}*)(displayName=*{escapedQuery}*))",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName", "department"]);
            var response = (SearchResponse)connection.SendRequest(request);
            return response.Entries
                .Cast<SearchResultEntry>()
                .Select(entry => new LdapDirectoryUser(
                    GetAttribute(entry, "distinguishedName") ?? string.Empty,
                    GetAttribute(entry, "sAMAccountName")
                        ?? GetAttribute(entry, "userPrincipalName")
                        ?? GetAttribute(entry, "mail")
                        ?? string.Empty,
                    GetAttribute(entry, "displayName")
                        ?? GetAttribute(entry, "sAMAccountName")
                        ?? GetAttribute(entry, "userPrincipalName")
                        ?? string.Empty,
                    GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName"),
                    ResolveDepartment(entry)))
                .Where(entry => !string.IsNullOrWhiteSpace(entry.ExternalIdentityId))
                .DistinctBy(entry => entry.ExternalIdentityId, StringComparer.OrdinalIgnoreCase)
                .OrderBy(entry => entry.DisplayName)
                .Take(GetSearchResultLimit())
                .ToArray();
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP search failed for query '{Query}'", query);
            return [];
        }
    }

    private LdapDirectoryUser? FindUserByExternalIdentityInternal(TenantLdapRuntimeSettings settings, string externalIdentityId)
    {
        if (!settings.CanSearch || string.IsNullOrWhiteSpace(settings.Host))
        {
            return null;
        }

        var identifier = new LdapDirectoryIdentifier(settings.Host, settings.Port);
        using var connection = CreateConnection(settings, identifier);

        try
        {
            connection.Bind(new NetworkCredential(settings.BindDn, settings.BindPassword));
            var request = new SearchRequest(
                settings.SearchBase,
                $"(distinguishedName={Escape(externalIdentityId.Trim())})",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName", "department"]);
            var response = (SearchResponse)connection.SendRequest(request);
            if (response.Entries.Count == 0)
            {
                return null;
            }

            var entry = response.Entries[0];
            return new LdapDirectoryUser(
                GetAttribute(entry, "distinguishedName") ?? externalIdentityId,
                GetAttribute(entry, "sAMAccountName")
                    ?? GetAttribute(entry, "userPrincipalName")
                    ?? GetAttribute(entry, "mail")
                    ?? externalIdentityId,
                GetAttribute(entry, "displayName")
                    ?? GetAttribute(entry, "sAMAccountName")
                    ?? GetAttribute(entry, "userPrincipalName")
                    ?? externalIdentityId,
                GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName"),
                ResolveDepartment(entry));
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP lookup failed for external identity {ExternalIdentityId}", externalIdentityId);
            return null;
        }
    }

    private LdapDirectoryUser? FindUserByUsernameInternal(TenantLdapRuntimeSettings settings, string username)
    {
        if (!settings.CanSearch || string.IsNullOrWhiteSpace(settings.Host))
        {
            return null;
        }

        var identifier = new LdapDirectoryIdentifier(settings.Host, settings.Port);
        using var connection = CreateConnection(settings, identifier);

        try
        {
            connection.Bind(new NetworkCredential(settings.BindDn, settings.BindPassword));
            var escapedUsername = Escape(username.Trim());
            var request = new SearchRequest(
                settings.SearchBase,
                $"(|({settings.UserAttribute}={escapedUsername})(sAMAccountName={escapedUsername})(userPrincipalName={escapedUsername})(mail={escapedUsername}))",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName", "department"]);
            var response = (SearchResponse)connection.SendRequest(request);
            if (response.Entries.Count == 0)
            {
                return null;
            }

            var entry = response.Entries[0];
            return new LdapDirectoryUser(
                GetAttribute(entry, "distinguishedName") ?? username,
                GetAttribute(entry, "sAMAccountName")
                    ?? GetAttribute(entry, "userPrincipalName")
                    ?? GetAttribute(entry, "mail")
                    ?? username,
                GetAttribute(entry, "displayName")
                    ?? GetAttribute(entry, "sAMAccountName")
                    ?? GetAttribute(entry, "userPrincipalName")
                    ?? username,
                GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName"),
                ResolveDepartment(entry));
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP lookup failed for username {Username}", username);
            return null;
        }
    }

    private LdapConnection CreateConnection(TenantLdapRuntimeSettings settings, LdapDirectoryIdentifier identifier)
    {
        var connection = new LdapConnection(identifier)
        {
            AuthType = AuthType.Basic,
            SessionOptions =
            {
                ProtocolVersion = 3,
                SecureSocketLayer = settings.UseSsl,
                ReferralChasing = ReferralChasingOptions.None
            }
        };

        if (settings.IgnoreCertificateErrors)
        {
            connection.SessionOptions.VerifyServerCertificate += static (_, _) => true;
        }

        return connection;
    }

    private string BuildBindUsername(TenantLdapRuntimeSettings settings, string username)
    {
        if (!string.IsNullOrWhiteSpace(settings.Domain) && !username.Contains('@', StringComparison.Ordinal))
        {
            return $"{username}@{settings.Domain}";
        }

        return username;
    }

    private string? FindUserDistinguishedName(TenantLdapRuntimeSettings settings, LdapDirectoryIdentifier identifier, string username)
    {
        if (!settings.CanSearch)
        {
            return null;
        }

        using var connection = CreateConnection(settings, identifier);

        try
        {
            connection.Bind(new NetworkCredential(settings.BindDn, settings.BindPassword));
            var request = new SearchRequest(
                settings.SearchBase,
                $"(|({settings.UserAttribute}={Escape(username)})(sAMAccountName={Escape(username)})(userPrincipalName={Escape(username)}))",
                SearchScope.Subtree,
                ["distinguishedName"]);
            var response = (SearchResponse)connection.SendRequest(request);
            return response.Entries.Count > 0 ? response.Entries[0].DistinguishedName : null;
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP DN search failed for username {Username}", username);
            return null;
        }
    }

    private LdapAuthenticatedUser? FindUserProfile(TenantLdapRuntimeSettings settings, LdapDirectoryIdentifier identifier, string username)
    {
        if (!settings.CanSearch)
        {
            return null;
        }

        using var connection = CreateConnection(settings, identifier);

        try
        {
            connection.Bind(new NetworkCredential(settings.BindDn, settings.BindPassword));
            var request = new SearchRequest(
                settings.SearchBase,
                $"(|({settings.UserAttribute}={Escape(username)})(sAMAccountName={Escape(username)})(userPrincipalName={Escape(username)}))",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName"]);
            var response = (SearchResponse)connection.SendRequest(request);
            if (response.Entries.Count == 0)
            {
                return null;
            }

            var entry = response.Entries[0];
            return new LdapAuthenticatedUser(
                GetAttribute(entry, "distinguishedName") ?? username,
                GetAttribute(entry, "sAMAccountName")
                    ?? GetAttribute(entry, "userPrincipalName")
                    ?? GetAttribute(entry, "mail")
                    ?? username,
                GetAttribute(entry, "displayName") ?? username,
                GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName") ?? NormalizeEmail(username));
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP profile search failed for username");
            return null;
        }
    }

    private static string Escape(string value)
    {
        return value
            .Replace("\\", "\\5c", StringComparison.Ordinal)
            .Replace("*", "\\2a", StringComparison.Ordinal)
            .Replace("(", "\\28", StringComparison.Ordinal)
            .Replace(")", "\\29", StringComparison.Ordinal)
            .Replace("\0", "\\00", StringComparison.Ordinal);
    }

    private static string? GetAttribute(SearchResultEntry entry, string name)
    {
        return entry.Attributes.Contains(name) && entry.Attributes[name]?.Count > 0
            ? entry.Attributes[name]?[0]?.ToString()
            : null;
    }

    private static string? NormalizeEmail(string username)
    {
        return username.Contains('@', StringComparison.Ordinal) ? username : null;
    }

    /// <summary>
    /// Extracts the department OU from a distinguished name, skipping known non-department OUs.
    /// E.g. "CN=User,OU=Users,OU=Bilgi İşlem Müdürlüğü,OU=Tire Belediyesi,DC=..." → "Bilgi İşlem Müdürlüğü"
    /// </summary>
    private static readonly HashSet<string> NonDepartmentOUs = new(StringComparer.OrdinalIgnoreCase)
    {
        "Users", "Computers", "Domain Controllers", "Builtin",
        "Tire Belediyesi", "Tirebel"
    };

    private static string? ExtractDepartmentFromDn(string? dn)
    {
        if (string.IsNullOrWhiteSpace(dn))
        {
            return null;
        }

        foreach (var component in dn.Split(','))
        {
            var trimmed = component.Trim();
            if (trimmed.StartsWith("OU=", StringComparison.OrdinalIgnoreCase))
            {
                var value = trimmed[3..].Trim();
                if (!string.IsNullOrWhiteSpace(value) && !NonDepartmentOUs.Contains(value))
                {
                    return value;
                }
            }
        }

        return null;
    }

    private static string? ResolveDepartment(SearchResultEntry entry)
    {
        return GetAttribute(entry, "department") ?? ExtractDepartmentFromDn(GetAttribute(entry, "distinguishedName"));
    }

    private int GetSearchResultLimit()
    {
        return _searchResultLimit;
    }

    public Task<LdapConnectivityResult> TestConnectivityAsync(LdapConnectivityTestParameters parameters, CancellationToken cancellationToken = default)
    {
        return Task.Run(() => TestConnectivityInternal(parameters), cancellationToken);
    }

    private LdapConnectivityResult TestConnectivityInternal(LdapConnectivityTestParameters parameters)
    {
        if (string.IsNullOrWhiteSpace(parameters.Host))
        {
            return new LdapConnectivityResult(false, "Host is required.");
        }

        try
        {
            var identifier = new LdapDirectoryIdentifier(parameters.Host, parameters.Port);
            var settings = new TenantLdapRuntimeSettings(
                true,
                parameters.Host,
                parameters.Port,
                parameters.UseSsl,
                parameters.IgnoreCertificateErrors,
                parameters.Domain,
                parameters.SearchBase,
                parameters.BindDn,
                parameters.BindPassword,
                "sAMAccountName",
                true,
                true,
                []);

            using var connection = CreateConnection(settings, identifier);

            if (!string.IsNullOrWhiteSpace(parameters.BindDn) && !string.IsNullOrWhiteSpace(parameters.BindPassword))
            {
                connection.Bind(new NetworkCredential(parameters.BindDn, parameters.BindPassword));
            }
            else if (!string.IsNullOrWhiteSpace(parameters.Domain))
            {
                connection.Bind(new NetworkCredential(parameters.BindDn ?? string.Empty, parameters.BindPassword ?? string.Empty, parameters.Domain));
            }
            else
            {
                connection.Bind(new NetworkCredential(parameters.BindDn ?? string.Empty, parameters.BindPassword ?? string.Empty));
            }

            return new LdapConnectivityResult(true, "Connection successful.");
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP connectivity test failed for host {Host}:{Port}", parameters.Host, parameters.Port);
            return new LdapConnectivityResult(false, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "LDAP connectivity test encountered an unexpected error for host {Host}:{Port}", parameters.Host, parameters.Port);
            return new LdapConnectivityResult(false, ex.Message);
        }
    }
}