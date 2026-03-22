using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record SearchDirectoryUsersQuery(string Query) : IQuery<IReadOnlyList<DirectoryUserLookupResponse>>;

public sealed class SearchDirectoryUsersQueryHandler : IRequestHandler<SearchDirectoryUsersQuery, IReadOnlyList<DirectoryUserLookupResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public SearchDirectoryUsersQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILdapAuthenticationService ldapAuthenticationService,
        ITenantLdapSettingsService tenantLdapSettingsService,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _ldapAuthenticationService = ldapAuthenticationService;
        _tenantLdapSettingsService = tenantLdapSettingsService;
        _localizer = localizer;
    }

    public async Task<IReadOnlyList<DirectoryUserLookupResponse>> Handle(SearchDirectoryUsersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().TenantId!.Value;
        var ldapSettings = await _tenantLdapSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        if (!ldapSettings.CanSearch)
        {
            throw new ValidationException(_localizer["ValidationLdapSearchUnavailable"]);
        }

        var normalizedQuery = request.Query.Trim();
        if (string.IsNullOrWhiteSpace(normalizedQuery))
        {
            return [];
        }

        var candidates = await _ldapAuthenticationService.SearchUsersAsync(tenantId, normalizedQuery, cancellationToken);
        if (candidates.Count == 0)
        {
            return [];
        }

        var externalIds = candidates.Select(candidate => candidate.ExternalIdentityId).ToArray();
        var emails = candidates
            .Select(candidate => candidate.Email)
            .Where(email => !string.IsNullOrWhiteSpace(email))
            .Cast<string>()
            .ToArray();

        var existingUsers = await _dbContext.Users
            .Where(entity => entity.TenantId == tenantId)
            .Where(entity =>
                (entity.ExternalIdentityId != null && externalIds.Contains(entity.ExternalIdentityId)) ||
                (entity.Email != null && emails.Contains(entity.Email)))
            .Select(entity => new
            {
                entity.UserId,
                entity.ExternalIdentityId,
                entity.Email,
            })
            .ToListAsync(cancellationToken);

        return candidates
            .Select(candidate =>
            {
                var existing = existingUsers.FirstOrDefault(entity =>
                    string.Equals(entity.ExternalIdentityId, candidate.ExternalIdentityId, StringComparison.OrdinalIgnoreCase) ||
                    (!string.IsNullOrWhiteSpace(candidate.Email) && string.Equals(entity.Email, candidate.Email, StringComparison.OrdinalIgnoreCase)));

                return new DirectoryUserLookupResponse(
                    candidate.ExternalIdentityId,
                    candidate.Username,
                    candidate.DisplayName,
                    candidate.Email,
                    existing is not null,
                    existing?.UserId);
            })
            .ToArray();
    }
}