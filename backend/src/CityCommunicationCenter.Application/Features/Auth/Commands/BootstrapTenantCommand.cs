using CityCommunicationCenter.Application.Abstractions.Identity;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record BootstrapTenantCommand(
    string MunicipalityName,
    string? DisplayName,
    string AdminDisplayName,
    string AdminEmail,
    string AdminPassword) : ICommand<BootstrapTenantResponse?>;

public sealed class BootstrapTenantCommandValidator : AbstractValidator<BootstrapTenantCommand>
{
    public BootstrapTenantCommandValidator()
    {
        RuleFor(command => command.MunicipalityName)
            .NotEmpty()
            .WithMessage("Belediye adi zorunludur.")
            .MaximumLength(200);
        RuleFor(command => command.AdminDisplayName)
            .NotEmpty()
            .WithMessage("Yonetici adi zorunludur.")
            .MaximumLength(200);
        RuleFor(command => command.AdminEmail)
            .NotEmpty()
            .WithMessage("Yonetici e-posta adresi zorunludur.")
            .EmailAddress()
            .WithMessage("Gecerli bir yonetici e-posta adresi girilmelidir.");
        RuleFor(command => command.AdminPassword)
            .NotEmpty()
            .WithMessage("Yonetici sifresi zorunludur.")
            .MinimumLength(8)
            .WithMessage("Yonetici sifresi en az 8 karakter olmalidir.");
    }
}

public sealed class BootstrapTenantCommandHandler : IRequestHandler<BootstrapTenantCommand, BootstrapTenantResponse?>
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

    public async Task<BootstrapTenantResponse?> Handle(BootstrapTenantCommand request, CancellationToken cancellationToken)
    {
        var municipalityName = request.MunicipalityName.Trim();
        var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? municipalityName : request.DisplayName.Trim();
        var adminDisplayName = request.AdminDisplayName.Trim();
        var adminEmail = request.AdminEmail.Trim();
        var adminPassword = request.AdminPassword.Trim();

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
            DeploymentMode = DeploymentMode.DedicatedHosted,
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
            DisplayName = adminDisplayName,
            Email = adminEmail,
            RoleCode = RoleCode.SystemAdmin,
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
            adminDisplayName,
            adminEmail,
            _authenticationModeProvider.GetBootstrapAuthMode());
    }
}