using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Auth;

public sealed record StartInteractiveAuthenticationCommand(
    string TenantId,
    string? Username,
    string? Password) : ICommand<StartInteractiveAuthenticationResponse>;

public sealed class StartInteractiveAuthenticationCommandValidator : AbstractValidator<StartInteractiveAuthenticationCommand>
{
    public StartInteractiveAuthenticationCommandValidator()
    {
        RuleFor(command => command.TenantId)
            .NotEmpty();
    }
}

public sealed class StartInteractiveAuthenticationCommandHandler : ICommandHandler<StartInteractiveAuthenticationCommand, StartInteractiveAuthenticationResponse>
{
    private readonly IInteractiveAuthenticationService _interactiveAuthenticationService;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public StartInteractiveAuthenticationCommandHandler(
        IInteractiveAuthenticationService interactiveAuthenticationService,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _interactiveAuthenticationService = interactiveAuthenticationService;
        _localizer = localizer;
    }

    public async ValueTask<StartInteractiveAuthenticationResponse> Handle(StartInteractiveAuthenticationCommand request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantId))
        {
            return CreateFailureResponse(InteractiveAuthenticationFailureCode.InvalidTenant, false, false, null, false);
        }

        var result = await _interactiveAuthenticationService.StartAsync(
            tenantId,
            string.IsNullOrWhiteSpace(request.Username) ? null : request.Username.Trim(),
            request.Password,
            cancellationToken);

        return result.Status switch
        {
            InteractiveAuthenticationStatus.ReadyToExchange => new StartInteractiveAuthenticationResponse(
                result.Status.ToString(),
                result.IsTrustedNetwork,
                result.SecondFactorRequiredOnSuccess,
                result.AutomaticSignInMode,
                result.AuthenticationMode,
                null,
                null,
                null,
                result.ExpiresAtUtc,
                result.Grant is null ? null : new InteractiveAuthenticationGrant(result.Grant.Username, result.Grant.Password),
                result.MockCodePreview,
                false),
            InteractiveAuthenticationStatus.SecondFactorRequired => new StartInteractiveAuthenticationResponse(
                result.Status.ToString(),
                result.IsTrustedNetwork,
                result.SecondFactorRequiredOnSuccess,
                result.AutomaticSignInMode,
                result.AuthenticationMode,
                result.ChallengeId,
                result.DeliveryDestination,
                string.IsNullOrWhiteSpace(result.DeliveryDestination)
                    ? _localizer["AuthInteractiveChallengeSentWithoutDestination"].Value
                    : string.Format(_localizer["AuthInteractiveChallengeSent"].Value, result.DeliveryDestination),
                result.ExpiresAtUtc,
                null,
                result.MockCodePreview,
                false),
            InteractiveAuthenticationStatus.CredentialsRequired => new StartInteractiveAuthenticationResponse(
                result.Status.ToString(),
                result.IsTrustedNetwork,
                result.SecondFactorRequiredOnSuccess,
                result.AutomaticSignInMode,
                null,
                null,
                null,
                result.IsTrustedNetwork && !string.IsNullOrWhiteSpace(result.AutomaticSignInMode)
                    ? _localizer["AuthInteractiveFallbackToCredentials"].Value
                    : result.SecondFactorRequiredOnSuccess
                        ? _localizer["AuthInteractiveSecondFactorWillBeRequired"].Value
                        : null,
                null,
                null,
                null,
                result.ShouldChallengeNegotiate),
            _ => CreateFailureResponse(result.FailureCode, result.IsTrustedNetwork, result.SecondFactorRequiredOnSuccess, result.AutomaticSignInMode, result.ShouldChallengeNegotiate),
        };
    }

    private StartInteractiveAuthenticationResponse CreateFailureResponse(
        InteractiveAuthenticationFailureCode failureCode,
        bool isTrustedNetwork,
        bool secondFactorRequiredOnSuccess,
        string? automaticSignInMode,
        bool shouldChallengeNegotiate)
    {
        var message = failureCode switch
        {
            InteractiveAuthenticationFailureCode.InvalidTenant => _localizer["AuthInteractiveInvalidTenant"].Value,
            InteractiveAuthenticationFailureCode.SecondFactorProviderUnavailable => _localizer["AuthInteractiveSecondFactorUnavailable"].Value,
            _ => _localizer["AuthInvalidCredentials"].Value,
        };

        return new StartInteractiveAuthenticationResponse(
            InteractiveAuthenticationStatus.Failed.ToString(),
            isTrustedNetwork,
            secondFactorRequiredOnSuccess,
            automaticSignInMode,
            null,
            null,
            null,
            message,
            null,
            null,
            null,
            shouldChallengeNegotiate);
    }
}