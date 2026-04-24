using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateTenantAuthenticationPolicyCommand(
    Guid TenantId,
    bool AutomaticSignInEnabled,
    string AutomaticSignInMode,
    IReadOnlyList<string> TrustedNetworkCidrs,
    IReadOnlyList<string> TrustedProxyCidrs,
    string? IdentityHeaderName,
    bool RequireSecondFactorOutsideTrustedNetwork,
    string SecondFactorProvider,
    int CodeLength,
    int CodeTtlSeconds,
    bool AllowMockCodePreview,
    string? WebhookUrl) : ICommand<Unit>;

public sealed class UpdateTenantAuthenticationPolicyCommandValidator : AbstractValidator<UpdateTenantAuthenticationPolicyCommand>
{
    public UpdateTenantAuthenticationPolicyCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.TenantId)
            .NotEmpty();

        RuleFor(command => command.AutomaticSignInMode)
            .NotEmpty()
            .Must(value => Enum.TryParse<AutomaticSignInMode>(value, true, out _))
            .WithMessage(localizer["ValidationAutomaticSignInModeRequired"]);

        RuleFor(command => command.SecondFactorProvider)
            .NotEmpty()
            .Must(value => Enum.TryParse<SecondFactorProviderType>(value, true, out _))
            .WithMessage(localizer["ValidationSecondFactorProviderRequired"]);

        RuleFor(command => command.TrustedNetworkCidrs)
            .Must(value => value.Count > 0)
            .When(command => command.AutomaticSignInEnabled)
            .WithMessage(localizer["ValidationTrustedNetworkRequired"]);

        RuleFor(command => command.IdentityHeaderName)
            .NotEmpty()
            .When(command => command.AutomaticSignInEnabled && string.Equals(command.AutomaticSignInMode, AutomaticSignInMode.TrustedHeader.ToString(), StringComparison.OrdinalIgnoreCase))
            .WithMessage(localizer["ValidationIdentityHeaderRequired"]);

        RuleFor(command => command.WebhookUrl)
            .NotEmpty()
            .When(command => command.RequireSecondFactorOutsideTrustedNetwork && string.Equals(command.SecondFactorProvider, SecondFactorProviderType.Webhook.ToString(), StringComparison.OrdinalIgnoreCase))
            .WithMessage(localizer["ValidationWebhookUrlRequired"]);

        RuleFor(command => command.CodeLength)
            .InclusiveBetween(4, 8)
            .WithMessage(localizer["ValidationCodeLengthRange"]);

        RuleFor(command => command.CodeTtlSeconds)
            .InclusiveBetween(60, 900)
            .WithMessage(localizer["ValidationCodeTtlRange"]);
    }
}

public sealed class UpdateTenantAuthenticationPolicyCommandHandler : ICommandHandler<UpdateTenantAuthenticationPolicyCommand, Unit>
{
    private readonly ITenantAuthenticationPolicyService _tenantAuthenticationPolicyService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTenantAuthenticationPolicyCommandHandler(
        ITenantAuthenticationPolicyService tenantAuthenticationPolicyService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _tenantAuthenticationPolicyService = tenantAuthenticationPolicyService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateTenantAuthenticationPolicyCommand request, CancellationToken cancellationToken)
    {
        await _tenantAuthenticationPolicyService.SaveSettingsAsync(
            request.TenantId,
            new TenantAuthenticationPolicyUpdate(
                request.AutomaticSignInEnabled,
                request.AutomaticSignInMode,
                request.TrustedNetworkCidrs,
                request.TrustedProxyCidrs,
                request.IdentityHeaderName,
                request.RequireSecondFactorOutsideTrustedNetwork,
                request.SecondFactorProvider,
                request.CodeLength,
                request.CodeTtlSeconds,
                request.AllowMockCodePreview,
                request.WebhookUrl),
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);

        return Unit.Value;
    }
}