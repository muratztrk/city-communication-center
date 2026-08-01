namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateSmsSettingsCommand(
    Guid TenantId,
    bool IsEnabled,
    string Provider,
    string? ApiUrl,
    string? Username,
    string? Password,
    bool ClearPassword,
    string? Originator,
    string? ChargedNumber) : ICommand<Unit>;

public sealed class UpdateSmsSettingsCommandValidator : AbstractValidator<UpdateSmsSettingsCommand>
{
    private static readonly string[] ValidProviders =
        ["NetGSM", "Iletimerkezi", "Verimor", "Custom", "Asistel", "JettMesaj"];

    /// <summary>Gerçek gönderim entegrasyonu yazılmış sağlayıcılar.</summary>
    private static readonly string[] SendableProviders = ["Asistel", "JettMesaj"];

    public UpdateSmsSettingsCommandValidator()
    {
        RuleFor(command => command.TenantId)
            .NotEmpty();

        When(command => command.IsEnabled, () =>
        {
            RuleFor(command => command.Provider)
                .Must(p => ValidProviders.Contains(p))
                .WithMessage("Sağlayıcı şunlardan biri olmalı: NetGSM, İletimerkezi, Verimor, Özel, Asistel, jeTTMesaj.");

            When(command => command.Provider == "Custom", () =>
            {
                RuleFor(command => command.ApiUrl)
                    .NotEmpty()
                    .WithMessage("Sağlayıcı 'Özel' seçildiğinde API URL zorunludur.");
            });

            // Başlık (alfaNumeric/sender) olmadan sağlayıcı 109 döndürür; kaydetmeden yakala.
            When(command => SendableProviders.Contains(command.Provider), () =>
            {
                RuleFor(command => command.Originator)
                    .NotEmpty()
                    .WithMessage("Gönderici Adı (SMS başlığı) zorunludur; sağlayıcıda onaylı olmalıdır.");

                RuleFor(command => command.Username)
                    .NotEmpty()
                    .WithMessage("SMS kullanıcı adı zorunludur.");
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
                request.Originator,
                request.ChargedNumber),
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);

        return Unit.Value;
    }
}
