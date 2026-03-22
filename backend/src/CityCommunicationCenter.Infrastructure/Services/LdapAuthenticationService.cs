using System.DirectoryServices.Protocols;
using System.Net;
using System.Security.Cryptography.X509Certificates;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class LdapAuthenticationService : ILdapAuthenticationService
{
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly int _searchResultLimit;

    public LdapAuthenticationService(ITenantLdapSettingsService tenantLdapSettingsService, IOptions<AuthenticationOptions> options)
    {
        _tenantLdapSettingsService = tenantLdapSettingsService;
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
                    candidate.Email))
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
                : new LdapDirectoryUser(mockUser.ExternalIdentityId, mockUser.Username, mockUser.DisplayName, mockUser.Email);
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
                : new LdapDirectoryUser(mockUser.ExternalIdentityId, mockUser.Username, mockUser.DisplayName, mockUser.Email);
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
        catch (LdapException)
        {
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
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName"]);
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
                    GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName")))
                .Where(entry => !string.IsNullOrWhiteSpace(entry.ExternalIdentityId))
                .DistinctBy(entry => entry.ExternalIdentityId, StringComparer.OrdinalIgnoreCase)
                .OrderBy(entry => entry.DisplayName)
                .Take(GetSearchResultLimit())
                .ToArray();
        }
        catch (LdapException)
        {
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
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName"]);
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
                GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName"));
        }
        catch (LdapException)
        {
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
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName"]);
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
                GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName"));
        }
        catch (LdapException)
        {
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
                SecureSocketLayer = settings.UseSsl
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
        catch (LdapException)
        {
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
        catch (LdapException)
        {
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

    private int GetSearchResultLimit()
    {
        return _searchResultLimit;
    }
}