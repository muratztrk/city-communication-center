using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record ImportLdapUsersCommand(Guid TenantId) : ICommand<ImportLdapUsersResponse>;

public sealed class ImportLdapUsersCommandHandler : ICommandHandler<ImportLdapUsersCommand, ImportLdapUsersResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public ImportLdapUsersCommandHandler(
        IApplicationDbContext dbContext,
        ILdapAuthenticationService ldapAuthenticationService,
        ITenantLdapSettingsService tenantLdapSettingsService,
        ITenantContextAccessor tenantContextAccessor,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _ldapAuthenticationService = ldapAuthenticationService;
        _tenantLdapSettingsService = tenantLdapSettingsService;
        _tenantContextAccessor = tenantContextAccessor;
        _localizer = localizer;
    }

    public async ValueTask<ImportLdapUsersResponse> Handle(ImportLdapUsersCommand request, CancellationToken cancellationToken)
    {
        var tenantId = request.TenantId;
        var context = _tenantContextAccessor.GetCurrent();
        var actorUserId = context.UserId;

        var ldapSettings = await _tenantLdapSettingsService.GetSettingsAsync(tenantId, cancellationToken);
        if (!ldapSettings.CanSearch)
        {
            throw new ValidationException(_localizer["ValidationLdapSearchUnavailable"]);
        }

        var directoryUsers = await _ldapAuthenticationService.ListAllUsersAsync(tenantId, cancellationToken);
        if (directoryUsers.Count == 0)
        {
            return new ImportLdapUsersResponse(0, 0, 0, 0, [_localizer["ValidationLdapImportEmpty"].Value]);
        }

        var existingUsers = await _dbContext.Users
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId)
            .Select(entity => new
            {
                entity.ExternalIdentityId,
                entity.Username,
                entity.Email,
            })
            .ToListAsync(cancellationToken);

        var departments = await _dbContext.Departments
            .Where(entity => entity.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        var departmentByName = departments.ToDictionary(
            department => department.Name.ToUpperInvariant(),
            department => department);

        var created = 0;
        var skipped = 0;
        var failed = 0;
        var messages = new List<string>();

        foreach (var directoryUser in directoryUsers)
        {
            var externalIdentityId = directoryUser.ExternalIdentityId.Trim();
            var username = directoryUser.Username.Trim();
            var displayName = string.IsNullOrWhiteSpace(directoryUser.DisplayName) ? username : directoryUser.DisplayName.Trim();
            var email = string.IsNullOrWhiteSpace(directoryUser.Email) ? null : directoryUser.Email.Trim();
            var ldapDepartmentName = directoryUser.Department?.Trim();

            if (existingUsers.Any(entity =>
                    string.Equals(entity.ExternalIdentityId, externalIdentityId, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(entity.Username, username, StringComparison.OrdinalIgnoreCase)
                    || (email is not null && string.Equals(entity.Email, email, StringComparison.OrdinalIgnoreCase))))
            {
                skipped++;
                continue;
            }

            if (string.IsNullOrWhiteSpace(ldapDepartmentName))
            {
                failed++;
                messages.Add($"{username}: {_localizer["ValidationLdapImportMissingDepartment"].Value}");
                continue;
            }

            if (!departmentByName.TryGetValue(ldapDepartmentName.ToUpperInvariant(), out var department))
            {
                department = new Department
                {
                    DepartmentId = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = ldapDepartmentName,
                    DepartmentType = "Müdürlük",
                    CreatedByUserId = actorUserId,
                };
                _dbContext.Departments.Add(department);
                departmentByName[ldapDepartmentName.ToUpperInvariant()] = department;
            }

            var user = new ApplicationUser
            {
                UserId = Guid.NewGuid(),
                TenantId = tenantId,
                DepartmentId = department.DepartmentId,
                Username = username,
                DisplayName = displayName,
                Email = email,
                ExternalIdentityId = externalIdentityId,
                RoleCode = RoleCode.Staff,
                UserSource = UserSource.Ldap,
                IsActive = true,
                Title = string.IsNullOrWhiteSpace(directoryUser.Title) ? null : directoryUser.Title.Trim(),
                Phone = string.IsNullOrWhiteSpace(directoryUser.Phone) ? null : directoryUser.Phone.Trim(),
                CreatedByUserId = actorUserId,
            };

            _dbContext.Users.Add(user);
            existingUsers.Add(new { ExternalIdentityId = (string?)externalIdentityId, Username = (string?)username, Email = email });
            created++;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ImportLdapUsersResponse(directoryUsers.Count, created, skipped, failed, messages.Take(25).ToArray());
    }
}
