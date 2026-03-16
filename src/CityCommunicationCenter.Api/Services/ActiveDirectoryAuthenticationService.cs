using System.DirectoryServices.Protocols;
using System.Net;
using System.Text;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Api.Services;

public sealed class ActiveDirectoryOptions
{
    public const string SectionName = "ActiveDirectory";

    public bool Enabled { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 389;
    public bool UseSsl { get; set; }
    public bool IgnoreCertificateErrors { get; set; }
    public string Domain { get; set; } = string.Empty;
    public string SearchBase { get; set; } = string.Empty;
    public bool AutoProvisionUsers { get; set; }
    public string DefaultRoleCode { get; set; } = "Staff";
    public string DefaultDepartmentId { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 10;
}

public sealed record DirectoryUserInfo(
    string ExternalId,
    string UserPrincipalName,
    string? Email,
    string DisplayName);

public interface IActiveDirectoryAuthenticationService
{
    DirectoryUserInfo? Authenticate(string username, string password);
}

public sealed class ActiveDirectoryAuthenticationService : IActiveDirectoryAuthenticationService
{
    private readonly IOptions<ActiveDirectoryOptions> _options;
    private readonly ILogger<ActiveDirectoryAuthenticationService> _logger;

    public ActiveDirectoryAuthenticationService(
        IOptions<ActiveDirectoryOptions> options,
        ILogger<ActiveDirectoryAuthenticationService> logger)
    {
        _options = options;
        _logger = logger;
    }

    public DirectoryUserInfo? Authenticate(string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        var options = _options.Value;
        if (!options.Enabled)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(options.Host))
        {
            _logger.LogWarning("ActiveDirectory:Host is not configured. AD login cannot proceed.");
            return null;
        }

        var normalizedUsername = username.Trim();
        var bindIdentity = BuildBindIdentity(normalizedUsername, options.Domain);

        try
        {
            using var connection = CreateConnection(options);
            connection.Bind(new NetworkCredential(bindIdentity, password));

            var entry = TryFindUserEntry(connection, options, normalizedUsername, bindIdentity);
            return entry is null
                ? BuildFallbackUserInfo(normalizedUsername, bindIdentity)
                : BuildUserInfoFromEntry(entry, normalizedUsername, bindIdentity);
        }
        catch (LdapException ldapException)
        {
            _logger.LogWarning(
                ldapException,
                "Active Directory authentication failed for {Username}.",
                normalizedUsername);
            return null;
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "Unexpected Active Directory error during authentication for {Username}.",
                normalizedUsername);
            return null;
        }
    }

    private LdapConnection CreateConnection(ActiveDirectoryOptions options)
    {
        var ldapIdentifier = new LdapDirectoryIdentifier(options.Host, options.Port, fullyQualifiedDnsHostName: false, connectionless: false);
        var connection = new LdapConnection(ldapIdentifier)
        {
            AuthType = AuthType.Basic,
            Timeout = TimeSpan.FromSeconds(Math.Clamp(options.TimeoutSeconds, 5, 120))
        };

        connection.SessionOptions.ProtocolVersion = 3;
        connection.SessionOptions.SecureSocketLayer = options.UseSsl;

        if (options.IgnoreCertificateErrors)
        {
            connection.SessionOptions.VerifyServerCertificate = (_, _) => true;
        }

        return connection;
    }

    private SearchResultEntry? TryFindUserEntry(
        LdapConnection connection,
        ActiveDirectoryOptions options,
        string username,
        string bindIdentity)
    {
        var searchBase = ResolveSearchBase(connection, options);
        if (string.IsNullOrWhiteSpace(searchBase))
        {
            return null;
        }

        var filter = BuildUserFilter(username, bindIdentity);
        var request = new SearchRequest(
            searchBase,
            filter,
            SearchScope.Subtree,
            "objectGUID",
            "mail",
            "displayName",
            "userPrincipalName",
            "sAMAccountName");

        var response = (SearchResponse)connection.SendRequest(request);
        return response.Entries.Count > 0 ? response.Entries[0] : null;
    }

    private static string ResolveSearchBase(LdapConnection connection, ActiveDirectoryOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.SearchBase))
        {
            return options.SearchBase.Trim();
        }

        var rootRequest = new SearchRequest(
            null,
            "(objectClass=*)",
            SearchScope.Base,
            "defaultNamingContext");
        var rootResponse = (SearchResponse)connection.SendRequest(rootRequest);
        if (rootResponse.Entries.Count == 0)
        {
            return string.Empty;
        }

        return rootResponse.Entries[0].Attributes["defaultNamingContext"]?[0]?.ToString() ?? string.Empty;
    }

    private static string BuildBindIdentity(string username, string domain)
    {
        if (username.Contains('@') || username.Contains('\\'))
        {
            return username;
        }

        var trimmedDomain = domain.Trim().TrimStart('@');
        return string.IsNullOrWhiteSpace(trimmedDomain)
            ? username
            : $"{username}@{trimmedDomain}";
    }

    private static string BuildUserFilter(string username, string bindIdentity)
    {
        var simpleUser = username.Contains('\\')
            ? username[(username.LastIndexOf('\\') + 1)..]
            : username.Contains('@')
                ? username[..username.IndexOf('@')]
                : username;

        var escapedUsername = EscapeLdapFilterValue(username);
        var escapedBindIdentity = EscapeLdapFilterValue(bindIdentity);
        var escapedSimpleUser = EscapeLdapFilterValue(simpleUser);

        return "(&(objectCategory=person)(objectClass=user)" +
               "(|(userPrincipalName=" + escapedUsername + ")" +
               "(userPrincipalName=" + escapedBindIdentity + ")" +
               "(mail=" + escapedUsername + ")" +
               "(mail=" + escapedBindIdentity + ")" +
               "(sAMAccountName=" + escapedSimpleUser + ")))";
    }

    private static DirectoryUserInfo BuildUserInfoFromEntry(
        SearchResultEntry entry,
        string username,
        string bindIdentity)
    {
        var upn = ReadAttribute(entry, "userPrincipalName");
        var email = ReadAttribute(entry, "mail");
        var displayName = ReadAttribute(entry, "displayName");
        var objectGuid = ReadObjectGuid(entry);

        var resolvedUpn = !string.IsNullOrWhiteSpace(upn) ? upn : bindIdentity;
        var resolvedDisplayName = !string.IsNullOrWhiteSpace(displayName) ? displayName : username;
        var resolvedExternalId = !string.IsNullOrWhiteSpace(objectGuid) ? objectGuid : resolvedUpn;

        return new DirectoryUserInfo(
            resolvedExternalId,
            resolvedUpn,
            email,
            resolvedDisplayName);
    }

    private static DirectoryUserInfo BuildFallbackUserInfo(string username, string bindIdentity)
    {
        var email = bindIdentity.Contains('@') ? bindIdentity : username.Contains('@') ? username : null;
        return new DirectoryUserInfo(bindIdentity, bindIdentity, email, username);
    }

    private static string? ReadAttribute(SearchResultEntry entry, string attributeName)
    {
        var attribute = entry.Attributes[attributeName];
        if (attribute is null || attribute.Count == 0)
        {
            return null;
        }

        return attribute[0]?.ToString();
    }

    private static string? ReadObjectGuid(SearchResultEntry entry)
    {
        var attribute = entry.Attributes["objectGUID"];
        if (attribute is null || attribute.Count == 0 || attribute[0] is not byte[] bytes || bytes.Length != 16)
        {
            return null;
        }

        return new Guid(bytes).ToString();
    }

    private static string EscapeLdapFilterValue(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var character in value)
        {
            builder.Append(character switch
            {
                '\\' => "\\5c",
                '*' => "\\2a",
                '(' => "\\28",
                ')' => "\\29",
                '\0' => "\\00",
                _ => character.ToString()
            });
        }

        return builder.ToString();
    }
}
