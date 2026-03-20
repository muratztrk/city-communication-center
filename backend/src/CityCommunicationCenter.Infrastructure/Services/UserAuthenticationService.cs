using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Options;
using CityCommunicationCenter.Infrastructure.Persistence;

namespace CityCommunicationCenter.Infrastructure.Services;

public sealed class UserAuthenticationService : IUserAuthenticationService, IAuthenticationModeProvider
{
    private readonly CityCommunicationCenterDbContext _dbContext;
    private readonly AuthenticationOptions _options;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ILocalUserPasswordService _localUserPasswordService;

    public UserAuthenticationService(
        CityCommunicationCenterDbContext dbContext,
        IOptions<AuthenticationOptions> options,
        ILdapAuthenticationService ldapAuthenticationService,
        ILocalUserPasswordService localUserPasswordService)
    {
        _dbContext = dbContext;
        _options = options.Value;
        _ldapAuthenticationService = ldapAuthenticationService;
        _localUserPasswordService = localUserPasswordService;
    }

    public async Task<AuthenticatedUserDescriptor?> AuthenticateAsync(
        Guid tenantId,
        string username,
        string password,
        CancellationToken cancellationToken = default)
    {
        var tenant = await _dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(entity => entity.TenantId == tenantId && entity.IsActive, cancellationToken);

        if (tenant is null)
        {
            return null;
        }

        var user = await FindUserAsync(tenantId, username, cancellationToken);
        if (user is not null && user.IsActive && _options.EnableLocalUsers && _localUserPasswordService.VerifyPassword(user, password))
        {
            return ToDescriptor(user, tenant.DisplayName, "LocalUser");
        }

        var ldapUser = await _ldapAuthenticationService.AuthenticateAsync(username, password, cancellationToken);
        if (ldapUser is null)
        {
            return null;
        }

        user ??= await ProvisionLdapUserAsync(tenantId, username, ldapUser, cancellationToken);
        if (!user.IsActive)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(user.ExternalIdentityId) || !string.Equals(user.ExternalIdentityId, ldapUser.ExternalIdentityId, StringComparison.OrdinalIgnoreCase))
        {
            user.ExternalIdentityId = ldapUser.ExternalIdentityId;
            user.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        if (string.IsNullOrWhiteSpace(user.Email) && !string.IsNullOrWhiteSpace(ldapUser.Email))
        {
            user.Email = ldapUser.Email;
        }

        if (!string.IsNullOrWhiteSpace(ldapUser.DisplayName))
        {
            user.DisplayName = ldapUser.DisplayName;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return ToDescriptor(user, tenant.DisplayName, "Ldap");
    }

    public string GetBootstrapAuthMode()
    {
        return _options.Ldap.Enabled ? "LdapOrLocalUser" : "LocalUser";
    }

    private async Task<ApplicationUser?> FindUserAsync(Guid tenantId, string username, CancellationToken cancellationToken)
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
                entity => EF.Functions.ILike(entity.Email ?? string.Empty, normalizedUsername) ||
                          EF.Functions.ILike(entity.DisplayName, normalizedUsername) ||
                          EF.Functions.ILike(entity.ExternalIdentityId ?? string.Empty, normalizedUsername),
                cancellationToken);
    }

    private async Task<ApplicationUser> ProvisionLdapUserAsync(
        Guid tenantId,
        string username,
        LdapAuthenticatedUser ldapUser,
        CancellationToken cancellationToken)
    {
        var departmentId = await _dbContext.Departments
            .IgnoreQueryFilters()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => entity.DepartmentId)
            .FirstOrDefaultAsync(cancellationToken);

        if (departmentId == Guid.Empty)
        {
            var department = new Department
            {
                DepartmentId = Guid.NewGuid(),
                TenantId = tenantId,
                Name = "Dizin Kullanicilari",
                DepartmentType = "Directory",
                CreatedByUserId = null
            };

            _dbContext.Departments.Add(department);
            departmentId = department.DepartmentId;
        }

        var user = new ApplicationUser
        {
            UserId = Guid.NewGuid(),
            TenantId = tenantId,
            DepartmentId = departmentId,
            DisplayName = string.IsNullOrWhiteSpace(ldapUser.DisplayName) ? username : ldapUser.DisplayName,
            Email = ldapUser.Email,
            ExternalIdentityId = ldapUser.ExternalIdentityId,
            RoleCode = RoleCode.Staff,
            IsActive = true,
            CreatedByUserId = null
        };

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return user;
    }

    private static AuthenticatedUserDescriptor ToDescriptor(ApplicationUser user, string tenantName, string authenticationMode)
    {
        return new AuthenticatedUserDescriptor(
            user.UserId,
            user.TenantId,
            user.DepartmentId,
            user.DisplayName,
            user.Email ?? string.Empty,
            user.RoleCode.ToString(),
            tenantName,
            authenticationMode);
    }
}