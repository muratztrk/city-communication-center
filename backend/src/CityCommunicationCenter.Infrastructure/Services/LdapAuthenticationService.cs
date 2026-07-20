using System.DirectoryServices.Protocols;
using System.Globalization;
using System.Net;

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
            var searchTerms = ExpandSearchTerms(normalizedQuery);
            IReadOnlyList<LdapDirectoryUser> results = settings.MockUsers
                .Where(candidate => !IsMachineAccount(candidate.Username))
                .Where(candidate =>
                    searchTerms.Any(searchTerm =>
                        candidate.Username.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                        candidate.DisplayName.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                        (candidate.Email?.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ?? false)))
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

    public async Task<IReadOnlyList<string>> ListDepartmentNamesAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var settings = await _tenantLdapSettingsService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!settings.CanSearch)
        {
            return [];
        }

        if (settings.MockUsers.Count > 0 && string.IsNullOrWhiteSpace(settings.Host))
        {
            return [];
        }

        return await Task.Run(() => ListDepartmentNamesInternal(settings), cancellationToken);
    }

    public async Task<IReadOnlyList<LdapDirectoryUser>> ListUsersAsync(Guid tenantId, CancellationToken cancellationToken = default)
    {
        var settings = await _tenantLdapSettingsService.GetRuntimeSettingsAsync(tenantId, cancellationToken);
        if (!settings.CanSearch)
        {
            return [];
        }

        if (settings.MockUsers.Count > 0 && string.IsNullOrWhiteSpace(settings.Host))
        {
            return settings.MockUsers
                .Where(candidate => !IsMachineAccount(candidate.Username))
                .OrderBy(candidate => candidate.DisplayName)
                .Select(candidate => new LdapDirectoryUser(
                    candidate.ExternalIdentityId,
                    candidate.Username,
                    candidate.DisplayName,
                    candidate.Email,
                    null))
                .ToArray();
        }

        return await Task.Run(() => ListUsersInternal(settings), cancellationToken);
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

        var userDn = FindUserDistinguishedName(settings, identifier, username);
        if (userDn is not null)
        {
            // Found full DN via search — bind directly with it
            using var conn = CreateConnection(settings, identifier);
            try
            {
                conn.Bind(new NetworkCredential(userDn, password));
                var profile = FindUserProfile(settings, identifier, username) ?? new LdapAuthenticatedUser(userDn, username, username, NormalizeEmail(username));
                return profile with { ExternalIdentityId = string.IsNullOrWhiteSpace(profile.ExternalIdentityId) ? userDn : profile.ExternalIdentityId };
            }
            catch (LdapException ex)
            {
                _logger.LogWarning(ex, "LDAP bind failed (DN path) for user {Username}", username);
                return null;
            }
        }

        // No search base or search failed — try both username@domain and DOMAIN\username formats
        var candidates = BuildBindUsernameCandidates(settings, username);
        foreach (var candidate in candidates)
        {
            using var conn = CreateConnection(settings, identifier);
            try
            {
                conn.Bind(new NetworkCredential(candidate, password));
                _logger.LogInformation("LDAP bind succeeded with candidate format for user {Username}", username);
                return new LdapAuthenticatedUser(candidate, username, username, NormalizeEmail(username));
            }
            catch (LdapException ex)
            {
                _logger.LogDebug(ex, "LDAP bind failed with candidate '{Candidate}' for user {Username}", candidate, username);
            }
        }

        _logger.LogWarning("LDAP authentication failed for user {Username} — all formats exhausted", username);
        return null;
    }

    private IEnumerable<string> BuildBindUsernameCandidates(TenantLdapRuntimeSettings settings, string username)
    {
        var normalizedUsername = username.Trim();
        if (string.IsNullOrWhiteSpace(normalizedUsername))
        {
            yield break;
        }

        // If already a DN/UPN/DOMAIN\username — use as-is first, then no extra candidates
        if (LooksLikeDistinguishedName(normalizedUsername)
            || normalizedUsername.Contains('@', StringComparison.Ordinal)
            || normalizedUsername.Contains('\\', StringComparison.Ordinal))
        {
            yield return normalizedUsername;
            yield break;
        }

        if (!string.IsNullOrWhiteSpace(settings.Domain))
        {
            yield return $"{normalizedUsername}@{settings.Domain}";   // UPN: user@domain
            yield return $"{settings.Domain}\\{normalizedUsername}";  // NTLM: DOMAIN\user
        }

        yield return normalizedUsername; // bare fallback
    }

    private static bool LooksLikeDistinguishedName(string value)
    {
        return value.Contains('=', StringComparison.Ordinal) && value.Contains(',', StringComparison.Ordinal);
    }

    private void BindWithServiceAccount(LdapConnection connection, TenantLdapRuntimeSettings settings, string logContext)
    {
        BindWithCandidateIdentities(connection, settings, settings.BindDn ?? string.Empty, settings.BindPassword, logContext);
    }

    private void BindWithCandidateIdentities(
        LdapConnection connection,
        TenantLdapRuntimeSettings settings,
        string identity,
        string? password,
        string logContext)
    {
        LdapException? lastException = null;
        var candidates = BuildBindUsernameCandidates(settings, identity)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        foreach (var candidate in candidates)
        {
            try
            {
                connection.Bind(new NetworkCredential(candidate, password));
                return;
            }
            catch (LdapException ex)
            {
                lastException = ex;
                _logger.LogDebug(ex, "LDAP bind failed with candidate '{Candidate}' ({Context})", candidate, logContext);
            }
        }

        if (lastException is not null)
        {
            throw lastException;
        }

        throw new LdapException("No LDAP bind candidate available.");
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
            BindWithServiceAccount(connection, settings, "directory search");
            var searchTerms = ExpandSearchTerms(query.Trim());
            var request = new SearchRequest(
                settings.SearchBase,
                BuildDirectorySearchFilter(settings.UserAttribute, searchTerms),
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName",
                 "cn", "givenName", "sn", "physicalDeliveryOfficeName", "department", "description", "telephoneNumber"]);
            var response = (SearchResponse)connection.SendRequest(request);
            return response.Entries
                .Cast<SearchResultEntry>()
                .Where(entry => !IsMachineAccountEntry(entry))
                .Select(MapDirectoryUser)
                .Where(entry => !string.IsNullOrWhiteSpace(entry.ExternalIdentityId) && !string.IsNullOrWhiteSpace(entry.Username))
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

    private static LdapDirectoryUser MapDirectoryUser(SearchResultEntry entry)
    {
        var dn = GetDistinguishedName(entry);
        return new LdapDirectoryUser(
            dn ?? string.Empty,
            GetAttribute(entry, "sAMAccountName")
                ?? GetAttribute(entry, "userPrincipalName")
                ?? GetAttribute(entry, "mail")
                ?? string.Empty,
            GetAttribute(entry, "displayName")
                ?? GetAttribute(entry, "sAMAccountName")
                ?? GetAttribute(entry, "userPrincipalName")
                ?? string.Empty,
            // E-posta yalnız LDAP mail attribute; UPN fallback yok (card #1734).
            NormalizeDirectoryMail(GetAttribute(entry, "mail")),
            ResolveDepartment(entry),
            GetAttribute(entry, "description"),
            GetAttribute(entry, "telephoneNumber"),
            ExtractDepartmentFromDn(dn));
    }

    private static string? NormalizeDirectoryMail(string? mail)
    {
        var trimmed = mail?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
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
            BindWithServiceAccount(connection, settings, "find user by external identity");
            var request = new SearchRequest(
                settings.SearchBase,
                $"(distinguishedName={Escape(externalIdentityId.Trim())})",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName",
                 "physicalDeliveryOfficeName", "department", "description", "telephoneNumber"]);
            var response = (SearchResponse)connection.SendRequest(request);
            if (response.Entries.Count == 0)
            {
                return null;
            }

            var entry = response.Entries[0];
            return MapDirectoryUser(entry);
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
            BindWithServiceAccount(connection, settings, "find user by username");
            var escapedUsername = Escape(username.Trim());
            var request = new SearchRequest(
                settings.SearchBase,
                $"(|({settings.UserAttribute}={escapedUsername})(sAMAccountName={escapedUsername})(userPrincipalName={escapedUsername})(mail={escapedUsername}))",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName",
                 "physicalDeliveryOfficeName", "department", "description", "telephoneNumber"]);
            var response = (SearchResponse)connection.SendRequest(request);
            if (response.Entries.Count == 0)
            {
                return null;
            }

            var entry = response.Entries[0];
            return MapDirectoryUser(entry);
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

    private string? FindUserDistinguishedName(TenantLdapRuntimeSettings settings, LdapDirectoryIdentifier identifier, string username)
    {
        if (!settings.CanSearch)
        {
            return null;
        }

        using var connection = CreateConnection(settings, identifier);

        try
        {
            BindWithServiceAccount(connection, settings, "resolve user distinguished name");
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
            BindWithServiceAccount(connection, settings, "resolve user profile");
            var request = new SearchRequest(
                settings.SearchBase,
                $"(|({settings.UserAttribute}={Escape(username)})(sAMAccountName={Escape(username)})(userPrincipalName={Escape(username)}))",
                SearchScope.Subtree,
                ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName",
                 "physicalDeliveryOfficeName", "department", "description", "telephoneNumber"]);
            var response = (SearchResponse)connection.SendRequest(request);
            if (response.Entries.Count == 0)
            {
                return null;
            }

            var entry = response.Entries[0];
            return new LdapAuthenticatedUser(
                GetDistinguishedName(entry) ?? username,
                GetAttribute(entry, "sAMAccountName")
                    ?? GetAttribute(entry, "userPrincipalName")
                    ?? GetAttribute(entry, "mail")
                    ?? username,
                GetAttribute(entry, "displayName") ?? username,
                GetAttribute(entry, "mail") ?? GetAttribute(entry, "userPrincipalName") ?? NormalizeEmail(username),
                GetAttribute(entry, "description"),
                GetAttribute(entry, "telephoneNumber"));
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP profile search failed for username");
            return null;
        }
    }

    private static string BuildDirectorySearchFilter(string userAttribute, IReadOnlyList<string> searchTerms)
    {
        // ACCOUNTDISABLE (2) bit'i kapalı kullanıcılar hariç — yalnız aktif hesaplar (cards #1754/#1757).
        const string userAccountFilter =
            "(&(objectClass=user)(!(objectClass=computer))(!(sAMAccountName=*$))(!(userAccountControl:1.2.840.113556.1.4.803:=2)))";

        if (searchTerms.Count == 0)
        {
            return userAccountFilter;
        }

        return $"(&{userAccountFilter}(|{string.Concat(searchTerms.Select(BuildFilterForTerm))}))";

        string BuildFilterForTerm(string term)
        {
            var escaped = Escape(term);
            // Birim adı araması için department / office alanları da dahil (card #1730 — Emlak ve İstimlak).
            return $"(|({userAttribute}=*{escaped}*)(sAMAccountName=*{escaped}*)(userPrincipalName=*{escaped}*)(displayName=*{escaped}*)(cn=*{escaped}*)(givenName=*{escaped}*)(sn=*{escaped}*)(mail=*{escaped}*)(department=*{escaped}*)(physicalDeliveryOfficeName=*{escaped}*))";
        }
    }

    private IReadOnlyList<string> ListDepartmentNamesInternal(TenantLdapRuntimeSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.Host) || string.IsNullOrWhiteSpace(settings.SearchBase))
        {
            return [];
        }

        var names = new SortedSet<string>(StringComparer.Create(CultureInfo.GetCultureInfo("tr-TR"), CompareOptions.IgnoreCase));
        var identifier = new LdapDirectoryIdentifier(settings.Host, settings.Port);
        using var connection = CreateConnection(settings, identifier);

        try
        {
            BindWithServiceAccount(connection, settings, "list directory departments");
            CollectOrganizationalUnitNames(connection, settings.SearchBase, names);
            CollectDepartmentNamesFromUsers(connection, settings.SearchBase, names);
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP department listing failed");
        }

        return names.ToArray();
    }

    private IReadOnlyList<LdapDirectoryUser> ListUsersInternal(TenantLdapRuntimeSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.Host) || string.IsNullOrWhiteSpace(settings.SearchBase))
        {
            return [];
        }

        var byId = new Dictionary<string, LdapDirectoryUser>(StringComparer.OrdinalIgnoreCase);
        var identifier = new LdapDirectoryIdentifier(settings.Host, settings.Port);
        using var connection = CreateConnection(settings, identifier);

        try
        {
            BindWithServiceAccount(connection, settings, "list directory users");
            // Harf/rakam öneği — arama 50 limitine takılmadan toplu liste (card #1748).
            const string prefixes = "abcçdefgğhıijklmnoöprsştuüvyz0123456789";
            foreach (var prefix in prefixes)
            {
                try
                {
                    var escaped = Escape(prefix.ToString());
                    var filter =
                        $"(&(objectClass=user)(!(objectClass=computer))(!(sAMAccountName=*$))(!(userAccountControl:1.2.840.113556.1.4.803:=2))(|({settings.UserAttribute}={escaped}*)(sAMAccountName={escaped}*)(displayName={escaped}*)(cn={escaped}*)))";
                    var request = new SearchRequest(
                        settings.SearchBase,
                        filter,
                        SearchScope.Subtree,
                        ["distinguishedName", "displayName", "mail", "userPrincipalName", "sAMAccountName",
                         "cn", "givenName", "sn", "physicalDeliveryOfficeName", "department", "description", "telephoneNumber"])
                    {
                        SizeLimit = 200,
                    };
                    var response = (SearchResponse)connection.SendRequest(request);
                    foreach (SearchResultEntry entry in response.Entries)
                    {
                        if (IsMachineAccountEntry(entry))
                        {
                            continue;
                        }

                        var mapped = MapDirectoryUser(entry);
                        if (string.IsNullOrWhiteSpace(mapped.ExternalIdentityId) || string.IsNullOrWhiteSpace(mapped.Username))
                        {
                            continue;
                        }

                        byId.TryAdd(mapped.ExternalIdentityId, mapped);
                    }
                }
                catch (LdapException ex) when (ex.ErrorCode == 4)
                {
                    // Kısmi sonuç yeterli; sonraki önekle devam.
                }
                catch (LdapException ex)
                {
                    _logger.LogDebug(ex, "LDAP user prefix search failed for '{Prefix}'", prefix);
                }
            }
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP user listing failed");
        }

        return byId.Values
            .OrderBy(entry => entry.DisplayName, StringComparer.Create(CultureInfo.GetCultureInfo("tr-TR"), CompareOptions.IgnoreCase))
            .ToArray();
    }

    private void CollectOrganizationalUnitNames(LdapConnection connection, string searchBase, ISet<string> names)
    {
        try
        {
            var request = new SearchRequest(
                searchBase,
                "(objectClass=organizationalUnit)",
                SearchScope.Subtree,
                ["ou", "name", "distinguishedName"])
            {
                SizeLimit = 500,
            };
            var response = (SearchResponse)connection.SendRequest(request);
            foreach (SearchResultEntry entry in response.Entries)
            {
                var ouName = GetAttribute(entry, "ou")
                    ?? GetAttribute(entry, "name")
                    ?? ExtractDepartmentFromDn(GetDistinguishedName(entry));
                AddDepartmentName(names, ouName);
            }
        }
        catch (LdapException ex) when (ex.ErrorCode == 4 /* SizeLimitExceeded */)
        {
            _logger.LogInformation(ex, "LDAP OU listing hit size limit; using partial results");
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(ex, "LDAP OU listing failed");
        }
    }

    private void CollectDepartmentNamesFromUsers(LdapConnection connection, string searchBase, ISet<string> names)
    {
        // Harf bazlı department/office öneki — kullanıcı displayName limitine takılmadan birimleri toplar.
        const string letters = "abcçdefgğhıijklmnoöprsştuüvyz";
        foreach (var letter in letters)
        {
            try
            {
                var escaped = Escape(letter.ToString());
                var filter =
                    $"(&(objectClass=user)(!(objectClass=computer))(!(sAMAccountName=*$))(|(department={escaped}*)(physicalDeliveryOfficeName={escaped}*)))";
                var request = new SearchRequest(
                    searchBase,
                    filter,
                    SearchScope.Subtree,
                    ["distinguishedName", "physicalDeliveryOfficeName", "department"])
                {
                    SizeLimit = 100,
                };
                var response = (SearchResponse)connection.SendRequest(request);
                foreach (SearchResultEntry entry in response.Entries)
                {
                    AddDepartmentName(names, ResolveDepartment(entry));
                }
            }
            catch (LdapException ex) when (ex.ErrorCode == 4)
            {
                // Kısmi sonuç yeterli; sonraki harfle devam.
            }
            catch (LdapException ex)
            {
                _logger.LogDebug(ex, "LDAP department prefix search failed for '{Letter}'", letter);
            }
        }
    }

    private static void AddDepartmentName(ISet<string> names, string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || NonDepartmentOUs.Contains(trimmed))
        {
            return;
        }

        names.Add(trimmed);
    }

    private static IReadOnlyList<string> ExpandSearchTerms(string query)
    {
        const int maxVariants = 16;

        var terms = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddTerm(string value)
        {
            if (!string.IsNullOrWhiteSpace(value) && seen.Add(value))
            {
                terms.Add(value);
            }
        }

        AddTerm(query);

        var variants = new List<string> { string.Empty };
        foreach (var character in query)
        {
            var alternatives = GetSearchCharacterAlternatives(character);
            var next = new List<string>(Math.Min(maxVariants, variants.Count * alternatives.Length));

            foreach (var prefix in variants)
            {
                foreach (var alternative in alternatives)
                {
                    if (next.Count >= maxVariants)
                    {
                        break;
                    }

                    next.Add($"{prefix}{alternative}");
                }

                if (next.Count >= maxVariants)
                {
                    break;
                }
            }

            variants = next;
            if (variants.Count == 0)
            {
                break;
            }
        }

        foreach (var variant in variants)
        {
            AddTerm(variant);
        }

        AddTerm(NormalizeTurkishCharacters(query));
        return terms;
    }

    private static char[] GetSearchCharacterAlternatives(char character)
    {
        return character switch
        {
            'c' => ['c', 'ç'],
            'ç' => ['ç', 'c'],
            'C' => ['C', 'Ç'],
            'Ç' => ['Ç', 'C'],
            'g' => ['g', 'ğ'],
            'ğ' => ['ğ', 'g'],
            'G' => ['G', 'Ğ'],
            'Ğ' => ['Ğ', 'G'],
            'i' => ['i', 'ı'],
            'ı' => ['ı', 'i'],
            'I' => ['I', 'İ'],
            'İ' => ['İ', 'I'],
            'o' => ['o', 'ö'],
            'ö' => ['ö', 'o'],
            'O' => ['O', 'Ö'],
            'Ö' => ['Ö', 'O'],
            's' => ['s', 'ş'],
            'ş' => ['ş', 's'],
            'S' => ['S', 'Ş'],
            'Ş' => ['Ş', 'S'],
            'u' => ['u', 'ü'],
            'ü' => ['ü', 'u'],
            'U' => ['U', 'Ü'],
            'Ü' => ['Ü', 'U'],
            _ => [character],
        };
    }

    private static string NormalizeTurkishCharacters(string value)
    {
        return new string(value.Select(MapTurkishCharacter).ToArray());
    }

    private static char MapTurkishCharacter(char character)
    {
        return character switch
        {
            'ç' => 'c',
            'Ç' => 'C',
            'ğ' => 'g',
            'Ğ' => 'G',
            'ı' => 'i',
            'İ' => 'I',
            'ö' => 'o',
            'Ö' => 'O',
            'ş' => 's',
            'Ş' => 'S',
            'ü' => 'u',
            'Ü' => 'U',
            _ => character,
        };
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

    private static string? GetDistinguishedName(SearchResultEntry entry)
    {
        return !string.IsNullOrWhiteSpace(entry.DistinguishedName)
            ? entry.DistinguishedName
            : GetAttribute(entry, "distinguishedName");
    }

    private static bool IsMachineAccountEntry(SearchResultEntry entry)
    {
        return IsMachineAccount(GetAttribute(entry, "sAMAccountName"))
            || IsMachineAccount(GetAttribute(entry, "cn"));
    }

    private static bool IsMachineAccount(string? value)
    {
        return value?.TrimEnd().EndsWith('$') == true;
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
        // Birim eşlemesi yalnız office/department attribute — OU fallback yok (card #1763).
        return GetAttribute(entry, "physicalDeliveryOfficeName")
            ?? GetAttribute(entry, "department");
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

            if (!string.IsNullOrWhiteSpace(parameters.BindDn) || !string.IsNullOrWhiteSpace(parameters.BindPassword))
            {
                BindWithCandidateIdentities(
                    connection,
                    settings,
                    parameters.BindDn ?? string.Empty,
                    parameters.BindPassword,
                    "connectivity test");
            }
            else
            {
                connection.Bind();
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
