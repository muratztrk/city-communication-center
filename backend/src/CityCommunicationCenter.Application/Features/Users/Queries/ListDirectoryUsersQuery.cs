using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record ListDirectoryUsersQuery : IQuery<IReadOnlyList<DirectoryUserLookupResponse>>;

public sealed class ListDirectoryUsersQueryHandler : IQueryHandler<ListDirectoryUsersQuery, IReadOnlyList<DirectoryUserLookupResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public ListDirectoryUsersQueryHandler(
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

    public async ValueTask<IReadOnlyList<DirectoryUserLookupResponse>> Handle(ListDirectoryUsersQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var ldapSettings = await _tenantLdapSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        if (!ldapSettings.CanSearch)
        {
            throw new ValidationException(_localizer["ValidationLdapSearchUnavailable"]);
        }

        var candidates = await _ldapAuthenticationService.ListUsersAsync(tenantId, cancellationToken);
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
                    candidate.Department,
                    existing is not null,
                    existing?.UserId,
                    candidate.Title,
                    candidate.Phone);
            })
            .ToArray();
    }
}
