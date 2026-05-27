namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateSmsSettingsCommand(
    Guid TenantId,
    bool IsEnabled,
    string Provider,
    string? ApiUrl,
    string? Username,
    string? Password,
    bool ClearPassword,
    string? Originator) : ICommand<Unit>;

public sealed class UpdateSmsSettingsCommandValidator : AbstractValidator<UpdateSmsSettingsCommand>
{
    private static readonly string[] ValidProviders = ["NetGSM", "Iletimerkezi", "Verimor", "Custom"];

    public UpdateSmsSettingsCommandValidator()
    {
        RuleFor(command => command.TenantId)
            .NotEmpty();

        When(command => command.IsEnabled, () =>
        {
            RuleFor(command => command.Provider)
                .Must(p => ValidProviders.Contains(p))
                .WithMessage("Provider must be one of: NetGSM, Iletimerkezi, Verimor, Custom.");

            When(command => command.Provider == "Custom", () =>
            {
                RuleFor(command => command.ApiUrl)
                    .NotEmpty()
                    .WithMessage("ApiUrl is required when Provider is Custom.");
            });
        });
    }
}

public sealed class UpdateSmsSettingsCommandHandler : ICommandHandler<UpdateSmsSettingsCommand, Unit>
{
    private readonly ITenantSmsSettingsService _tenantSmsSettingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateSmsSettingsCommandHandler(
        ITenantSmsSettingsService tenantSmsSettingsService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _tenantSmsSettingsService = tenantSmsSettingsService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateSmsSettingsCommand request, CancellationToken cancellationToken)
    {
        var provider = Enum.TryParse<SmsProvider>(request.Provider, out var parsed) ? parsed : SmsProvider.NetGSM;

        await _tenantSmsSettingsService.SaveSettingsAsync(
            request.TenantId,
            new TenantSmsSettingsUpdate(
                request.IsEnabled,
                provider,
                request.ApiUrl,
                request.Username,
                request.Password,
                request.ClearPassword,
                request.Originator),
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);

        return Unit.Value;
    }
}
