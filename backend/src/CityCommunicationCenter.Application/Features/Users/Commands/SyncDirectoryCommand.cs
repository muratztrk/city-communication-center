using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record SyncDirectoryCommand() : ICommand<SyncDirectoryResult>;

public sealed record SyncDirectoryResult(
    int UpdatedCount,
    int UnchangedCount,
    int NewDirectoryCount,
    string Message);

public sealed class SyncDirectoryCommandHandler : ICommandHandler<SyncDirectoryCommand, SyncDirectoryResult>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public SyncDirectoryCommandHandler(
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

    public async ValueTask<SyncDirectoryResult> Handle(SyncDirectoryCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var ldapSettings = await _tenantLdapSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        if (!ldapSettings.CanSearch)
        {
            throw new ValidationException(_localizer["ValidationLdapSearchUnavailable"]);
        }

        var directoryUsers = await _ldapAuthenticationService.ListUsersAsync(tenantId, cancellationToken);
        var linkedUsers = await _dbContext.Users
            .Where(user => user.TenantId == tenantId && user.UserSource == UserSource.Ldap)
            .ToListAsync(cancellationToken);

        var byExternalId = linkedUsers
            .Where(user => !string.IsNullOrWhiteSpace(user.ExternalIdentityId))
            .GroupBy(user => user.ExternalIdentityId!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
        var byUsername = linkedUsers
            .Where(user => !string.IsNullOrWhiteSpace(user.Username))
            .GroupBy(user => user.Username!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var updatedCount = 0;
        var unchangedCount = 0;

        foreach (var directoryUser in directoryUsers)
        {
            ApplicationUser? linked = null;
            if (!string.IsNullOrWhiteSpace(directoryUser.ExternalIdentityId)
                && byExternalId.TryGetValue(directoryUser.ExternalIdentityId, out var byId))
            {
                linked = byId;
            }
            else if (!string.IsNullOrWhiteSpace(directoryUser.Username)
                && byUsername.TryGetValue(directoryUser.Username, out var byName))
            {
                linked = byName;
            }

            if (linked is null)
            {
                continue;
            }

            if (ApplyDirectoryProfile(linked, directoryUser))
            {
                linked.UpdatedAtUtc = DateTimeOffset.UtcNow;
                linked.UpdatedByUserId = context.UserId;
                updatedCount += 1;
            }
            else
            {
                unchangedCount += 1;
            }
        }

        var newDirectoryCount = directoryUsers.Count(candidate =>
        {
            var linkedById = !string.IsNullOrWhiteSpace(candidate.ExternalIdentityId)
                && byExternalId.ContainsKey(candidate.ExternalIdentityId);
            var linkedByName = !string.IsNullOrWhiteSpace(candidate.Username)
                && byUsername.ContainsKey(candidate.Username);
            return !linkedById && !linkedByName;
        });

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = "DirectorySync",
            EntityId = tenantId.ToString(),
            Action = "DirectorySyncCompleted",
            ActorUserId = context.UserId,
            Details = $"LDAP profil senkronu: updated={updatedCount}, unchanged={unchangedCount}, new={newDirectoryCount}.",
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        var message = updatedCount > 0
            ? $"{updatedCount} kullanıcının LDAP profili güncellendi."
            : "Güncellenecek LDAP profili bulunamadı.";

        return new SyncDirectoryResult(updatedCount, unchangedCount, newDirectoryCount, message);
    }

    private static bool ApplyDirectoryProfile(ApplicationUser user, LdapDirectoryUser directoryUser)
    {
        var changed = false;

        if (!string.IsNullOrWhiteSpace(directoryUser.Username)
            && !string.Equals(user.Username, directoryUser.Username, StringComparison.Ordinal))
        {
            user.Username = directoryUser.Username.Trim();
            changed = true;
        }

        if (!string.IsNullOrWhiteSpace(directoryUser.DisplayName)
            && !string.Equals(user.DisplayName, directoryUser.DisplayName, StringComparison.Ordinal))
        {
            user.DisplayName = directoryUser.DisplayName.Trim();
            changed = true;
        }

        var email = NormalizeOptionalEmail(directoryUser.Email);
        if (email is not null && !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            user.Email = email;
            changed = true;
        }

        var title = Truncate(directoryUser.Title, 200);
        if (title is not null && !string.Equals(user.Title, title, StringComparison.Ordinal))
        {
            user.Title = title;
            changed = true;
        }

        var phone = Truncate(directoryUser.Phone, 50);
        if (phone is not null && !string.Equals(user.Phone, phone, StringComparison.Ordinal))
        {
            user.Phone = phone;
            changed = true;
        }

        if (!string.IsNullOrWhiteSpace(directoryUser.ExternalIdentityId)
            && !string.Equals(user.ExternalIdentityId, directoryUser.ExternalIdentityId, StringComparison.OrdinalIgnoreCase))
        {
            user.ExternalIdentityId = directoryUser.ExternalIdentityId;
            changed = true;
        }

        return changed;
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    private static string? NormalizeOptionalEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Contains('@', StringComparison.Ordinal) ? trimmed : null;
    }
}
