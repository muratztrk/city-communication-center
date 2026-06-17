using FluentValidation.Results;
using Microsoft.Extensions.Localization;

namespace CityCommunicationCenter.Application.Features.Me;

public sealed record ChangeMyPasswordCommand(
    string CurrentPassword,
    string NewPassword,
    string ConfirmPassword) : ICommand<Unit>;

public sealed class ChangeMyPasswordCommandValidator : AbstractValidator<ChangeMyPasswordCommand>
{
    public ChangeMyPasswordCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.CurrentPassword)
            .NotEmpty()
            .WithMessage(localizer["ValidationCurrentPasswordRequired"]);

        RuleFor(command => command.NewPassword)
            .NotEmpty()
            .WithMessage(localizer["ValidationNewPasswordRequired"])
            .Must(PasswordPolicy.IsStrong)
            .WithMessage(localizer["ValidationPasswordPolicy"]);

        RuleFor(command => command.ConfirmPassword)
            .Equal(command => command.NewPassword)
            .WithMessage(localizer["ValidationNewPasswordMismatch"]);
    }
}

public sealed class ChangeMyPasswordCommandHandler : ICommandHandler<ChangeMyPasswordCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILocalUserPasswordService _localUserPasswordService;
    private readonly IStringLocalizer<ApplicationResource> _localizer;

    public ChangeMyPasswordCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILocalUserPasswordService localUserPasswordService,
        IStringLocalizer<ApplicationResource> localizer)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _localUserPasswordService = localUserPasswordService;
        _localizer = localizer;
    }

    public async ValueTask<Unit> Handle(ChangeMyPasswordCommand request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var userId = context.UserId;

        if (!userId.HasValue || userId.Value == Guid.Empty)
        {
            throw new ForbiddenAccessException(_localizer["ValidationUserNotFound"]);
        }

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(
                entity => entity.UserId == userId.Value && entity.TenantId == tenantId,
                cancellationToken);

        if (user is null)
        {
            throw new ValidationException(_localizer["ValidationUserNotFound"]);
        }

        // Yalnızca yerel (Manual) kullanıcılar parolasını değiştirebilir; LDAP kullanıcıları dizinde yönetilir.
        if (user.UserSource != UserSource.Manual || string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            throw new ValidationException(
            [
                new ValidationFailure(nameof(request.CurrentPassword), _localizer["ValidationPasswordChangeNotAllowed"])
            ]);
        }

        if (!_localUserPasswordService.VerifyPassword(user, request.CurrentPassword))
        {
            throw new ValidationException(
            [
                new ValidationFailure(nameof(request.CurrentPassword), _localizer["ValidationCurrentPasswordIncorrect"])
            ]);
        }

        user.PasswordHash = _localUserPasswordService.HashPassword(user, request.NewPassword);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
