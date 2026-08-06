namespace CityCommunicationCenter.Application.Features.Me;

public sealed record SetLicenseModuleTestDisabledCommand(string Module, bool Disabled) : ICommand<LicenseModuleResponse>;

public sealed class SetLicenseModuleTestDisabledCommandValidator : AbstractValidator<SetLicenseModuleTestDisabledCommand>
{
    public SetLicenseModuleTestDisabledCommandValidator()
    {
        RuleFor(command => command.Module)
            .Must(module => module is "citizen" or "internal")
            .WithMessage("Geçersiz lisans modülü.");
    }
}

public sealed class SetLicenseModuleTestDisabledCommandHandler : ICommandHandler<SetLicenseModuleTestDisabledCommand, LicenseModuleResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILicenseModuleStatusService _licenseModuleStatusService;

    public SetLicenseModuleTestDisabledCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILicenseModuleStatusService licenseModuleStatusService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _licenseModuleStatusService = licenseModuleStatusService;
    }

    public async ValueTask<LicenseModuleResponse> Handle(SetLicenseModuleTestDisabledCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var municipalityName = await _dbContext.Tenants
            .Where(tenant => tenant.TenantId == tenantId)
            .Select(tenant => tenant.MunicipalityName)
            .FirstAsync(cancellationToken);
        var tenantSlug = TenantSlug.From(municipalityName);
        var module = request.Module == "citizen" ? LicenseModule.Citizen : LicenseModule.Internal;

        await _licenseModuleStatusService.SetTestDisabledAsync(tenantId, module, request.Disabled, cancellationToken);
        var status = await _licenseModuleStatusService.GetModuleStatusAsync(tenantId, tenantSlug, module, cancellationToken);
        return GetLicenseModulesQueryHandler.ToResponse(request.Module, status);
    }
}
