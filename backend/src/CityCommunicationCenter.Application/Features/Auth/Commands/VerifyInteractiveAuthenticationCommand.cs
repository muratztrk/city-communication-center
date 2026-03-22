using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record VerifyInteractiveAuthenticationCommand(
    string TenantId,
    string ChallengeId,
    string Code) : ICommand<VerifyInteractiveAuthenticationResponse>;

public sealed class VerifyInteractiveAuthenticationCommandValidator : AbstractValidator<VerifyInteractiveAuthenticationCommand>
{
    public VerifyInteractiveAuthenticationCommandValidator()
    {
        RuleFor(command => command.TenantId)
            .NotEmpty();
        RuleFor(command => command.ChallengeId)
            .NotEmpty();
        RuleFor(command => command.Code)
            .NotEmpty();
    }
}

public sealed class VerifyInteractiveAuthenticationCommandHandler : IRequestHandler<VerifyInteractiveAuthenticationCommand, VerifyInteractiveAuthenticationResponse>
{
    private readonly IInteractiveAuthenticationService _interactiveAuthenticationService;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public VerifyInteractiveAuthenticationCommandHandler(
        IInteractiveAuthenticationService interactiveAuthenticationService,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _interactiveAuthenticationService = interactiveAuthenticationService;
        _localizer = localizer;
    }

    public async Task<VerifyInteractiveAuthenticationResponse> Handle(VerifyInteractiveAuthenticationCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantId))
        {
            return CreateFailureResponse(InteractiveAuthenticationFailureCode.InvalidTenant);
        }

        var result = await _interactiveAuthenticationService.VerifyAsync(tenantId, request.ChallengeId.Trim(), request.Code.Trim(), cancellationToken);
        if (result.Status == InteractiveAuthenticationStatus.ReadyToExchange)
        {
            return new VerifyInteractiveAuthenticationResponse(
                result.Status.ToString(),
                result.AuthenticationMode,
                _localizer["AuthInteractiveChallengeVerified"].Value,
                result.ExpiresAtUtc,
                result.Grant is null ? null : new InteractiveAuthenticationGrant(result.Grant.Username, result.Grant.Password),
                result.MockCodePreview);
        }

        return CreateFailureResponse(result.FailureCode);
    }

    private VerifyInteractiveAuthenticationResponse CreateFailureResponse(InteractiveAuthenticationFailureCode failureCode)
    {
        var message = failureCode switch
        {
            InteractiveAuthenticationFailureCode.InvalidTenant => _localizer["AuthInteractiveInvalidTenant"].Value,
            InteractiveAuthenticationFailureCode.ChallengeExpired => _localizer["AuthInteractiveChallengeExpired"].Value,
            InteractiveAuthenticationFailureCode.TooManyAttempts => _localizer["AuthInteractiveTooManyAttempts"].Value,
            _ => _localizer["AuthInteractiveInvalidChallengeCode"].Value,
        };

        return new VerifyInteractiveAuthenticationResponse(
            InteractiveAuthenticationStatus.Failed.ToString(),
            null,
            message,
            null,
            null,
            null);
    }
}