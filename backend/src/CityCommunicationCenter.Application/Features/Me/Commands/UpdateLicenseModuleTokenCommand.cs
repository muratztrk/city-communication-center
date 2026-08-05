using FluentValidation.Results;

namespace CityCommunicationCenter.Application.Features.Me;

public sealed record UpdateLicenseModuleTokenCommand(string Module, string Token) : ICommand<LicenseModuleResponse>;

public sealed class UpdateLicenseModuleTokenCommandValidator : AbstractValidator<UpdateLicenseModuleTokenCommand>
{
    public UpdateLicenseModuleTokenCommandValidator()
    {
        RuleFor(command => command.Module)
            .NotEmpty()
            .Must(module => module is "citizen" or "internal")
            .WithMessage("Geçersiz lisans modülü. citizen veya internal olmalıdır.");

        RuleFor(command => command.Token)
            .NotEmpty()
            .WithMessage("Lisans kodu boş olamaz.");
    }
}

public sealed class UpdateLicenseModuleTokenCommandHandler : ICommandHandler<UpdateLicenseModuleTokenCommand, LicenseModuleResponse>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILicenseModuleStatusService _licenseModuleStatusService;

    public UpdateLicenseModuleTokenCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILicenseModuleStatusService licenseModuleStatusService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _licenseModuleStatusService = licenseModuleStatusService;
    }

    public async ValueTask<LicenseModuleResponse> Handle(UpdateLicenseModuleTokenCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var municipalityName = await _dbContext.Tenants
            .Where(tenant => tenant.TenantId == tenantId)
            .Select(tenant => tenant.MunicipalityName)
            .FirstAsync(cancellationToken);
        var tenantSlug = TenantSlug.From(municipalityName);
        var module = request.Module == "citizen" ? LicenseModule.Citizen : LicenseModule.Internal;

        try
        {
            await _licenseModuleStatusService.SaveStoredTokenAsync(
                tenantId,
                module,
                tenantSlug,
                request.Token.Trim(),
                cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            throw new ValidationException([new ValidationFailure(nameof(request.Token), ex.Message)]);
        }

        var status = await _licenseModuleStatusService.GetModuleStatusAsync(
            tenantId,
            tenantSlug,
            module,
            cancellationToken);

        return GetLicenseModulesQueryHandler.ToResponse(request.Module, status);
    }
}
