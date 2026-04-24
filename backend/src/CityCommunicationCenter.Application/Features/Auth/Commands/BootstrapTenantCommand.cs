using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record BootstrapTenantCommand(
    string MunicipalityName,
    string? DisplayName,
    string? DeploymentMode,
    string AdminUsername,
    string AdminDisplayName,
    string? AdminEmail,
    string AdminPassword) : ICommand<BootstrapTenantResponse?>;

public sealed class BootstrapTenantCommandValidator : AbstractValidator<BootstrapTenantCommand>
{
    public BootstrapTenantCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.MunicipalityName)
            .NotEmpty()
            .WithMessage(localizer["ValidationMunicipalityRequired"])
            .MaximumLength(200);
        RuleFor(command => command.AdminDisplayName)
            .NotEmpty()
            .WithMessage(localizer["ValidationAdminNameRequired"])
            .MaximumLength(200);

        RuleFor(command => command.AdminUsername)
            .NotEmpty()
            .WithMessage(localizer["ValidationAdminUsernameRequired"])
            .MaximumLength(100);

        RuleFor(command => command.AdminEmail)
            .EmailAddress()
            .When(command => !string.IsNullOrWhiteSpace(command.AdminEmail))
            .WithMessage(localizer["ValidationAdminEmailRequired"]);
        RuleFor(command => command.AdminPassword)
            .NotEmpty()
            .MinimumLength(8)
            .WithMessage(localizer["ValidationAdminPasswordRequired"]);
        RuleFor(command => command.DeploymentMode)
            .Must(value => string.IsNullOrWhiteSpace(value) || Enum.TryParse<CityCommunicationCenter.Domain.Enums.DeploymentMode>(value, true, out _))
            .WithMessage(localizer["ValidationDeploymentModeRequired"]);
    }
}

public sealed class BootstrapTenantCommandHandler : ICommandHandler<BootstrapTenantCommand, BootstrapTenantResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly IAuthenticationModeProvider _authenticationModeProvider;
    private readonly ILocalUserPasswordService _localUserPasswordService;

    public BootstrapTenantCommandHandler(
        IApplicationDbContext dbContext,
        IAuthenticationModeProvider authenticationModeProvider,
        ILocalUserPasswordService localUserPasswordService)
    {
        _dbContext = dbContext;
        _authenticationModeProvider = authenticationModeProvider;
        _localUserPasswordService = localUserPasswordService;
    }

    public async ValueTask<BootstrapTenantResponse?> Handle(BootstrapTenantCommand request, CancellationToken cancellationToken)
    {
        var municipalityName = request.MunicipalityName.Trim();
        var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? municipalityName : request.DisplayName.Trim();
        var adminUsername = request.AdminUsername.Trim();
        var adminDisplayName = request.AdminDisplayName.Trim();
        var adminEmail = string.IsNullOrWhiteSpace(request.AdminEmail) ? null : request.AdminEmail.Trim();
        var adminPassword = request.AdminPassword.Trim();
        var deploymentMode = string.IsNullOrWhiteSpace(request.DeploymentMode)
            ? CityCommunicationCenter.Domain.Enums.DeploymentMode.DedicatedHosted
            : Enum.Parse<CityCommunicationCenter.Domain.Enums.DeploymentMode>(request.DeploymentMode, true);

        if (await _dbContext.Tenants.AnyAsync(cancellationToken))
        {
            return null;
        }

        var tenantId = Guid.NewGuid();
        var adminDepartmentId = Guid.NewGuid();
        var adminUserId = Guid.NewGuid();

        var tenant = new Tenant
        {
            TenantId = tenantId,
            MunicipalityName = municipalityName,
            DisplayName = displayName,
            DeploymentMode = deploymentMode,
            IsActive = true
        };

        var adminDepartment = new Department
        {
            DepartmentId = adminDepartmentId,
            TenantId = tenantId,
            Name = "Sistem Yonetimi",
            DepartmentType = "Administration",
            CreatedByUserId = adminUserId
        };

        var adminUser = new ApplicationUser
        {
            UserId = adminUserId,
            TenantId = tenantId,
            DepartmentId = adminDepartmentId,
            Username = adminUsername,
            DisplayName = adminDisplayName,
            Email = adminEmail,
            RoleCode = RoleCode.SystemAdmin,
            UserSource = UserSource.Manual,
            IsActive = true,
            CreatedByUserId = adminUserId
        };
        adminUser.PasswordHash = _localUserPasswordService.HashPassword(adminUser, adminPassword);

        var tenantSetting = new TenantSetting
        {
            TenantSettingId = Guid.NewGuid(),
            TenantId = tenantId,
            DisplayName = displayName,
            DefaultSlaHours = 48,
            AutoRoutingEnabled = false,
            CreatedByUserId = adminUserId
        };

        _dbContext.Tenants.Add(tenant);
        _dbContext.Departments.Add(adminDepartment);
        _dbContext.Users.Add(adminUser);
        _dbContext.TenantSettings.Add(tenantSetting);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new BootstrapTenantResponse(
            tenantId.ToString(),
            municipalityName,
            displayName,
            deploymentMode.ToString(),
            tenant.Domain,
            adminUsername,
            adminDisplayName,
            adminEmail,
            _authenticationModeProvider.GetBootstrapAuthMode());
    }
}