using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Users;

public sealed record CreateUserCommand(
    string? Username,
    string DisplayName,
    string? Email,
    string? Password,
    Guid DepartmentId,
    string RoleCode,
    bool IsActive,
    string SourceType,
    string? ExternalIdentityId,
    string? LdapDepartmentName) : ICommand<UserSummaryResponse>;

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
            .When(command => !string.IsNullOrWhiteSpace(command.Email))
            .WithMessage(localizer["ValidationEmailRequired"]);

        RuleFor(command => command.Password)
            .MinimumLength(8)
            .When(command => !string.IsNullOrWhiteSpace(command.Password))
            .WithMessage(localizer["ValidationPasswordMinLength"]);

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
            if (directoryUser is null)
            {
                throw new ValidationException(_localizer["ValidationLdapUserNotFound"]);
            }

            displayName = string.IsNullOrWhiteSpace(directoryUser.DisplayName)
                ? directoryUser.Username
                : directoryUser.DisplayName;
            email = string.IsNullOrWhiteSpace(directoryUser.Email) ? null : directoryUser.Email.Trim();
            externalIdentityId = directoryUser.ExternalIdentityId;
            username = directoryUser.Username.Trim();
            ldapTitle = string.IsNullOrWhiteSpace(directoryUser.Title) ? null : directoryUser.Title.Trim();
            ldapPhone = string.IsNullOrWhiteSpace(directoryUser.Phone) ? null : directoryUser.Phone.Trim();
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

        if (email is not null)
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
            Title = ldapTitle,
            Phone = ldapPhone,
            CreatedByUserId = context.UserId,
        };

        if (sourceType == UserSource.Manual)
        {
            user.PasswordHash = _localUserPasswordService.HashPassword(user, request.Password!);
        }

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync(cancellationToken);

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
            user.Phone);
    }
}
