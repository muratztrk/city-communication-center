using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record CreateUserCommand(
    string? Username,
    string DisplayName,
    string? Email,
    string? Password,
    Guid DepartmentId,
    IReadOnlyCollection<Guid>? AdditionalDepartmentIds,
    string RoleCode,
    IReadOnlyCollection<string>? AdditionalRoleCodes,
    bool IsActive,
    string SourceType,
    string? ExternalIdentityId,
    string? LdapDepartmentName,
    string? Title = null,
    string? Phone = null) : ICommand<UserSummaryResponse>;

public sealed class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.Username)
            .MaximumLength(100)
            .When(command => !string.IsNullOrWhiteSpace(command.Username))
            .WithMessage(localizer["ValidationUsernameTooLong"]);

        RuleFor(command => command.Username)
            .NotEmpty()
            .When(command => string.Equals(command.SourceType, UserSource.Manual.ToString(), StringComparison.OrdinalIgnoreCase))
            .WithMessage(localizer["ValidationUsernameRequired"]);

        RuleFor(command => command.DisplayName)
            .MaximumLength(200)
            .When(command => !string.IsNullOrWhiteSpace(command.DisplayName))
            .WithMessage(localizer["ValidationDisplayNameRequired"]);

        RuleFor(command => command.DisplayName)
            .NotEmpty()
            .When(command => string.Equals(command.SourceType, UserSource.Manual.ToString(), StringComparison.OrdinalIgnoreCase))
            .WithMessage(localizer["ValidationDisplayNameRequired"]);

        RuleFor(command => command.Email)
            .EmailAddress()
            .When(command =>
                !string.IsNullOrWhiteSpace(command.Email)
                && !string.Equals(command.SourceType, UserSource.Ldap.ToString(), StringComparison.OrdinalIgnoreCase))
            .WithMessage(localizer["ValidationEmailRequired"]);

        RuleFor(command => command.Password)
            .Must(PasswordPolicy.IsStrong)
            .When(command => !string.IsNullOrWhiteSpace(command.Password))
            .WithMessage(localizer["ValidationPasswordPolicy"]);

        RuleFor(command => command.Password)
            .NotEmpty()
            .When(command => string.Equals(command.SourceType, UserSource.Manual.ToString(), StringComparison.OrdinalIgnoreCase))
            .WithMessage(localizer["ValidationManualPasswordRequired"]);

        RuleFor(command => command.DepartmentId)
            .NotEmpty()
            .When(command => string.IsNullOrWhiteSpace(command.LdapDepartmentName))
            .WithMessage(localizer["ValidationDepartmentRequired"]);

        RuleFor(command => command.RoleCode)
            .NotEmpty()
            .Must(value => Enum.TryParse<RoleCode>(value, true, out _))
            .WithMessage(localizer["ValidationRoleRequired"]);

        RuleFor(command => command.SourceType)
            .NotEmpty()
            .Must(value => Enum.TryParse<UserSource>(value, true, out _))
            .WithMessage(localizer["ValidationUserSourceRequired"]);

        RuleFor(command => command.ExternalIdentityId)
            .NotEmpty()
            .When(command => string.Equals(command.SourceType, UserSource.Ldap.ToString(), StringComparison.OrdinalIgnoreCase))
            .WithMessage(localizer["ValidationLdapIdentifierRequired"]);

        RuleFor(command => command.Title)
            .MaximumLength(200)
            .When(command => !string.IsNullOrWhiteSpace(command.Title));

        // LDAP telephoneNumber bazen uzun/formatlı gelebilir — 50 karakteri aşanı handler kısaltır.
        RuleFor(command => command.Phone)
            .MaximumLength(50)
            .When(command =>
                !string.IsNullOrWhiteSpace(command.Phone)
                && !string.Equals(command.SourceType, UserSource.Ldap.ToString(), StringComparison.OrdinalIgnoreCase));
    }
}

public sealed class CreateUserCommandHandler : ICommandHandler<CreateUserCommand, UserSummaryResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ILdapAuthenticationService _ldapAuthenticationService;
    private readonly ILocalUserPasswordService _localUserPasswordService;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public CreateUserCommandHandler(
        IApplicationDbContext dbContext,
        ILdapAuthenticationService ldapAuthenticationService,
        ILocalUserPasswordService localUserPasswordService,
        ITenantContextAccessor tenantContextAccessor,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _ldapAuthenticationService = ldapAuthenticationService;
        _localUserPasswordService = localUserPasswordService;
        _tenantContextAccessor = tenantContextAccessor;
        _localizer = localizer;
    }

    public async ValueTask<UserSummaryResponse> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var username = string.IsNullOrWhiteSpace(request.Username) ? null : request.Username.Trim();
        var displayName = request.DisplayName.Trim();
        var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        var sourceType = Enum.Parse<UserSource>(request.SourceType, true);
        var externalIdentityId = string.IsNullOrWhiteSpace(request.ExternalIdentityId) ? null : request.ExternalIdentityId.Trim();
        string? ldapTitle = null;
        string? ldapPhone = null;

        if (sourceType == UserSource.Ldap)
        {
            var directoryUser = await _ldapAuthenticationService.FindUserByExternalIdentityAsync(tenantId, externalIdentityId!, cancellationToken);
            // DN filtre eşleşmesi başarısız olursa sAMAccountName ile dene (card #1784).
            if (directoryUser is null && !string.IsNullOrWhiteSpace(username))
            {
                directoryUser = await _ldapAuthenticationService.FindUserByUsernameAsync(tenantId, username, cancellationToken);
            }

            if (directoryUser is null)
            {
                throw new ValidationException(_localizer["ValidationLdapUserNotFound"]);
            }

            displayName = string.IsNullOrWhiteSpace(directoryUser.DisplayName)
                ? directoryUser.Username
                : directoryUser.DisplayName;
            email = NormalizeOptionalEmail(directoryUser.Email);
            externalIdentityId = directoryUser.ExternalIdentityId;
            username = directoryUser.Username.Trim();
            ldapTitle = Truncate(directoryUser.Title, 200);
            ldapPhone = Truncate(directoryUser.Phone, 50);
        }
        else
        {
            email = NormalizeOptionalEmail(email);
        }

        var departmentId = request.DepartmentId;
        var ldapDepartmentName = request.LdapDepartmentName?.Trim();
        Department? department = null;

        // Auto-resolve department from LDAP department name
        if (departmentId == Guid.Empty && !string.IsNullOrWhiteSpace(ldapDepartmentName))
        {
            var normalizedName = ldapDepartmentName.ToUpperInvariant();
            var existingDepartment = await _dbContext.Departments
                .FirstOrDefaultAsync(
                    entity => entity.TenantId == tenantId && entity.Name.ToUpper() == normalizedName,
                    cancellationToken);

            if (existingDepartment is not null)
            {
                department = existingDepartment;
                departmentId = existingDepartment.DepartmentId;
            }
            else
            {
                var newDepartment = new Department
                {
                    DepartmentId = Guid.NewGuid(),
                    TenantId = tenantId,
                    Name = ldapDepartmentName,
                    DepartmentType = "Müdürlük",
                    CreatedByUserId = context.UserId,
                };
                _dbContext.Departments.Add(newDepartment);
                department = newDepartment;
                departmentId = newDepartment.DepartmentId;
            }
        }
        else
        {
            department = await _dbContext.Departments
                .FirstOrDefaultAsync(
                    entity => entity.DepartmentId == departmentId && entity.TenantId == tenantId,
                    cancellationToken);
        }

        if (department is null)
        {
            throw new ValidationException(_localizer["ValidationDepartmentNotFound"]);
        }

        // LDAP'ta aynı e-posta birden fazla hesapta olabilir — uniqueness yalnız Manual (card #1785).
        if (email is not null && sourceType == UserSource.Manual)
        {
            var normalizedEmailUpper = email.ToUpperInvariant();
            var emailExists = await _dbContext.Users
                .AnyAsync(
                    entity => entity.TenantId == tenantId
                        && entity.Email != null
                        && entity.Email.ToUpper() == normalizedEmailUpper,
                    cancellationToken);

            if (emailExists)
            {
                throw new ValidationException(_localizer["ValidationUserEmailExists"]);
            }
        }

        if (username is not null)
        {
            var normalizedUsernameUpper = username.ToUpperInvariant();
            var usernameExists = await _dbContext.Users
                .AnyAsync(
                    entity => entity.TenantId == tenantId
                        && entity.Username != null
                        && entity.Username.ToUpper() == normalizedUsernameUpper,
                    cancellationToken);

            if (usernameExists)
            {
                throw new ValidationException(_localizer["ValidationUserUsernameExists"]);
            }
        }

        if (externalIdentityId is not null)
        {
            var externalIdentityExists = await _dbContext.Users
                .AnyAsync(
                    entity => entity.TenantId == tenantId
                        && entity.ExternalIdentityId != null
                        && entity.ExternalIdentityId.ToUpper() == externalIdentityId.ToUpper(),
                    cancellationToken);

            if (externalIdentityExists)
            {
                throw new ValidationException(_localizer["ValidationUserExternalIdentityExists"]);
            }
        }

        var roleCode = Enum.Parse<RoleCode>(request.RoleCode, true);
        if (roleCode == RoleCode.Manager)
        {
            await UserManagerQuotaValidator.EnsureSingleManagerPerDepartmentAsync(
                _dbContext,
                tenantId,
                departmentId,
                currentUserId: null,
                cancellationToken);
        }

        var user = new ApplicationUser
        {
            UserId = Guid.NewGuid(),
            TenantId = tenantId,
            DepartmentId = departmentId,
            Username = username,
            DisplayName = displayName,
            Email = email,
            ExternalIdentityId = externalIdentityId,
            RoleCode = roleCode,
            UserSource = sourceType,
            IsActive = request.IsActive,
            Title = Truncate(string.IsNullOrWhiteSpace(request.Title) ? ldapTitle : request.Title.Trim(), 200),
            Phone = Truncate(string.IsNullOrWhiteSpace(request.Phone) ? ldapPhone : request.Phone.Trim(), 50),
            CreatedByUserId = context.UserId,
        };

        if (sourceType == UserSource.Manual)
        {
            user.PasswordHash = _localUserPasswordService.HashPassword(user, request.Password!);
        }

        _dbContext.Users.Add(user);
        UserRoleAccess.ApplyAdditionalRoleCodes(user, request.AdditionalRoleCodes);
        await UserDepartmentAccess.ReplaceAdditionalAssignmentsAsync(
            _dbContext,
            tenantId,
            user.UserId,
            user.DepartmentId,
            request.AdditionalDepartmentIds,
            context.UserId,
            DateTimeOffset.UtcNow,
            cancellationToken);

        _dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(ApplicationUser),
            EntityId = user.UserId.ToString(),
            Action = "UserCreated",
            ActorUserId = context.UserId,
            Details = $"User '{user.DisplayName}' created (role={user.RoleCode}).",
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        var departments = await UserDepartmentAccess.GetMembershipDepartmentSummariesAsync(
            _dbContext,
            tenantId,
            user,
            cancellationToken);

        return new UserSummaryResponse(
            user.UserId,
            user.TenantId,
            user.DepartmentId,
            user.Username,
            user.DisplayName,
            user.Email,
            user.RoleCode.ToString(),
            user.IsActive,
            sourceType.ToString(),
            user.Title,
            user.Phone,
            departments,
            UserRoleAccess.GetAdditionalRoleCodeStrings(user));
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
        // LDAP mail bazen geçersiz formatta gelir; uniqueness için geçerli olanları sakla (card #1784).
        return trimmed.Contains('@', StringComparison.Ordinal) ? trimmed : null;
    }
}
