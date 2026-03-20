using System.DirectoryServices.Protocols;
using System.Net;
using System.Security.Cryptography.X509Certificates;
using CityCommunicationCenter.Infrastructure.Options;

namespace CityCommunicationCenter.Infrastructure.Services;

public interface ILdapAuthenticationService
{
    Task<LdapAuthenticatedUser?> AuthenticateAsync(string username, string password, CancellationToken cancellationToken = default);
}

public sealed record LdapAuthenticatedUser(string ExternalIdentityId, string? DisplayName, string? Email);

internal sealed class LdapAuthenticationService : ILdapAuthenticationService
{
    private readonly LdapAuthenticationOptions _options;

    public LdapAuthenticationService(IOptions<AuthenticationOptions> options)
    {
        _options = options.Value.Ldap;
    }

    public Task<LdapAuthenticatedUser?> AuthenticateAsync(string username, string password, CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.Host) || string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return Task.FromResult<LdapAuthenticatedUser?>(null);
        }

        return Task.Run(() => AuthenticateInternal(username, password), cancellationToken);
    }

    private LdapAuthenticatedUser? AuthenticateInternal(string username, string password)
    {
        var identifier = new LdapDirectoryIdentifier(_options.Host, _options.Port);

        var userDn = FindUserDistinguishedName(identifier, username) ?? BuildBindUsername(username);
        using var connection = CreateConnection(identifier);

        try
        {
            connection.Bind(new NetworkCredential(userDn, password));
        }
        catch (LdapException)
        {
            return null;
        }

        var profile = FindUserProfile(identifier, username) ?? new LdapAuthenticatedUser(username, username, NormalizeEmail(username));
        return profile with { ExternalIdentityId = string.IsNullOrWhiteSpace(profile.ExternalIdentityId) ? username : profile.ExternalIdentityId };
    }

    private LdapConnection CreateConnection(LdapDirectoryIdentifier identifier)
    {
        var connection = new LdapConnection(identifier)
        {
            AuthType = AuthType.Basic,
            SessionOptions =
            {
                ProtocolVersion = 3,
                SecureSocketLayer = _options.UseSsl
            }
        };

        if (_options.IgnoreCertificateErrors)
        {
            connection.SessionOptions.VerifyServerCertificate += static (_, _) => true;
        }

        return connection;
    }

    private string BuildBindUsername(string username)
    {
        if (!string.IsNullOrWhiteSpace(_options.Domain) && !username.Contains('@', StringComparison.Ordinal))
        {
            return $"{username}@{_options.Domain}";
        }

        return username;
    }

    private string? FindUserDistinguishedName(LdapDirectoryIdentifier identifier, string username)
    {
        if (string.IsNullOrWhiteSpace(_options.SearchBase) || string.IsNullOrWhiteSpace(_options.BindDn))
        {
            return null;
        }

        using var connection = CreateConnection(identifier);

        try
        {
            connection.Bind(new NetworkCredential(_options.BindDn, _options.BindPassword));
            var request = new SearchRequest(
                _options.SearchBase,
                $"(|({_options.UserAttribute}={Escape(username)})(sAMAccountName={Escape(username)})(userPrincipalName={Escape(username)}))",
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

    private LdapAuthenticatedUser? FindUserProfile(LdapDirectoryIdentifier identifier, string username)
    {
        if (string.IsNullOrWhiteSpace(_options.SearchBase) || string.IsNullOrWhiteSpace(_options.BindDn))
        {
            return null;
        }

        using var connection = CreateConnection(identifier);

        try
        {
            connection.Bind(new NetworkCredential(_options.BindDn, _options.BindPassword));
            var request = new SearchRequest(
                _options.SearchBase,
                $"(|({_options.UserAttribute}={Escape(username)})(sAMAccountName={Escape(username)})(userPrincipalName={Escape(username)}))",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName"]);
            var response = (SearchResponse)connection.SendRequest(request);
            if (response.Entries.Count == 0)
            {
                return null;
            }

            var entry = response.Entries[0];
            return new LdapAuthenticatedUser(
                GetAttribute(entry, "distinguishedName") ?? username,
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
}