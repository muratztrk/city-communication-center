using System.Globalization;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record SyncDirectoryCommand() : ICommand<SyncDirectoryResult>;

public sealed record SyncDirectoryProfileChange(
    string Field,
    string? OldValue,
    string? NewValue);

public sealed record SyncDirectoryUpdatedUser(
    Guid UserId,
    string DisplayName,
    IReadOnlyList<SyncDirectoryProfileChange> Changes);

public sealed record SyncDirectoryResult(
    int UpdatedCount,
    int UnchangedCount,
    int NewDirectoryCount,
    string Message,
    IReadOnlyList<SyncDirectoryUpdatedUser> UpdatedUsers);

public sealed class SyncDirectoryCommandHandler : ICommandHandler<SyncDirectoryCommand, SyncDirectoryResult>
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

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

        var departments = await _dbContext.Departments
            .Where(department => department.TenantId == tenantId)
            .ToListAsync(cancellationToken);
        var departmentByName = departments
            .GroupBy(department => department.Name.Trim(), StringComparer.Create(Tr, CompareOptions.IgnoreCase))
            .ToDictionary(
                group => group.Key,
                group => group.First(),
                StringComparer.Create(Tr, CompareOptions.IgnoreCase));

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
        var updatedUsers = new List<SyncDirectoryUpdatedUser>();

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

            var profileChanges = ApplyDirectoryProfile(linked, directoryUser);
            var departmentChanged = await TryApplyDirectoryDepartmentAsync(
                linked,
                directoryUser.Department,
                departmentByName,
                tenantId,
                cancellationToken);
            if (departmentChanged)
            {
                profileChanges.Add(new SyncDirectoryProfileChange(
                    "Department",
                    null,
                    directoryUser.Department?.Trim()));
            }

            var previousRole = linked.RoleCode.ToString();
            var roleChanged = await TryApplyManagerRoleFromTitleAsync(
                linked,
                directoryUser.Title,
                tenantId,
                cancellationToken);
            if (roleChanged)
            {
                profileChanges.Add(new SyncDirectoryProfileChange(
                    "Role",
                    previousRole,
                    linked.RoleCode.ToString()));
            }

            if (profileChanges.Count > 0)
            {
                linked.UpdatedAtUtc = DateTimeOffset.UtcNow;
                linked.UpdatedByUserId = context.UserId;
                updatedCount += 1;
                updatedUsers.Add(new SyncDirectoryUpdatedUser(
                    linked.UserId,
                    linked.DisplayName,
                    profileChanges));
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

        return new SyncDirectoryResult(updatedCount, unchangedCount, newDirectoryCount, message, updatedUsers);
    }

    private static List<SyncDirectoryProfileChange> ApplyDirectoryProfile(ApplicationUser user, LdapDirectoryUser directoryUser)
    {
        var changes = new List<SyncDirectoryProfileChange>();

        if (!string.IsNullOrWhiteSpace(directoryUser.Username)
            && !string.Equals(user.Username, directoryUser.Username, StringComparison.Ordinal))
        {
            changes.Add(new SyncDirectoryProfileChange("Username", user.Username, directoryUser.Username.Trim()));
            user.Username = directoryUser.Username.Trim();
        }

        if (!string.IsNullOrWhiteSpace(directoryUser.DisplayName)
            && !string.Equals(user.DisplayName, directoryUser.DisplayName, StringComparison.Ordinal))
        {
            changes.Add(new SyncDirectoryProfileChange("DisplayName", user.DisplayName, directoryUser.DisplayName.Trim()));
            user.DisplayName = directoryUser.DisplayName.Trim();
        }

        var email = NormalizeOptionalEmail(directoryUser.Email);
        if (email is not null && !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            changes.Add(new SyncDirectoryProfileChange("Email", user.Email, email));
            user.Email = email;
        }

        var title = Truncate(directoryUser.Title, 200);
        if (title is not null && !string.Equals(user.Title, title, StringComparison.Ordinal))
        {
            changes.Add(new SyncDirectoryProfileChange("Title", user.Title, title));
            user.Title = title;
        }

        var phone = Truncate(directoryUser.Phone, 50);
        if (phone is not null && !string.Equals(user.Phone, phone, StringComparison.Ordinal))
        {
            changes.Add(new SyncDirectoryProfileChange("Phone", user.Phone, phone));
            user.Phone = phone;
        }

        if (!string.IsNullOrWhiteSpace(directoryUser.ExternalIdentityId)
            && !string.Equals(user.ExternalIdentityId, directoryUser.ExternalIdentityId, StringComparison.OrdinalIgnoreCase))
        {
            changes.Add(new SyncDirectoryProfileChange("ExternalIdentityId", user.ExternalIdentityId, directoryUser.ExternalIdentityId));
            user.ExternalIdentityId = directoryUser.ExternalIdentityId;
        }

        return changes;
    }

    /// <summary>LDAP birim adını sistem birimiyle eşleştirip günceller (card #1787 reopen).</summary>
    private async Task<bool> TryApplyDirectoryDepartmentAsync(
        ApplicationUser user,
        string? ldapDepartmentName,
        IReadOnlyDictionary<string, Department> departmentByName,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(ldapDepartmentName))
        {
            return false;
        }

        var key = ldapDepartmentName.Trim();
        if (!departmentByName.TryGetValue(key, out var department)
            || department.DepartmentId == user.DepartmentId)
        {
            return false;
        }

        if (user.RoleCode == RoleCode.Manager)
        {
            try
            {
                await UserManagerQuotaValidator.EnsureSingleManagerPerDepartmentAsync(
                    _dbContext,
                    tenantId,
                    department.DepartmentId,
                    user.UserId,
                    cancellationToken);
            }
            catch (ValidationException)
            {
                return false;
            }
        }

        user.DepartmentId = department.DepartmentId;
        return true;
    }

    private async Task<bool> TryApplyManagerRoleFromTitleAsync(
        ApplicationUser user,
        string? title,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        if (user.RoleCode is RoleCode.SystemAdmin or RoleCode.Manager)
        {
            return false;
        }

        if (!TurkishText.TitleImpliesManager(title ?? user.Title))
        {
            return false;
        }

        try
        {
            await UserManagerQuotaValidator.EnsureSingleManagerPerDepartmentAsync(
                _dbContext,
                tenantId,
                user.DepartmentId,
                user.UserId,
                cancellationToken);
        }
        catch (ValidationException)
        {
            return false;
        }

        user.RoleCode = RoleCode.Manager;
        return true;
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
