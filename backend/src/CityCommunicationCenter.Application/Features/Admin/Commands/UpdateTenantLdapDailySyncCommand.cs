using System.Globalization;
using CityCommunicationCenter.Application.Abstractions.Identity;
using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateTenantLdapDailySyncCommand(
    Guid TenantId,
    bool DailySyncEnabled,
    string? DailySyncTime) : ICommand<Unit>;

public sealed class UpdateTenantLdapDailySyncCommandValidator : AbstractValidator<UpdateTenantLdapDailySyncCommand>
{
    public UpdateTenantLdapDailySyncCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.DailySyncTime)
            .Must(value => string.IsNullOrWhiteSpace(value)
                || TimeOnly.TryParse(value.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
            .WithMessage("Günlük LDAP senkron saati HH:mm formatında olmalıdır.");
        When(command => command.DailySyncEnabled, () =>
        {
            RuleFor(command => command.DailySyncTime)
                .NotEmpty()
                .WithMessage("Günlük LDAP senkronu için saat gereklidir.");
        });
    }
}

public sealed class UpdateTenantLdapDailySyncCommandHandler : ICommandHandler<UpdateTenantLdapDailySyncCommand, Unit>
{
    private readonly ITenantLdapSettingsService _tenantLdapSettingsService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTenantLdapDailySyncCommandHandler(
        ITenantLdapSettingsService tenantLdapSettingsService,
        ITenantContextAccessor tenantContextAccessor)
    {
        _tenantLdapSettingsService = tenantLdapSettingsService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateTenantLdapDailySyncCommand request, CancellationToken cancellationToken)
    {
        await _tenantLdapSettingsService.SaveDailySyncAsync(
            request.TenantId,
            request.DailySyncEnabled,
            request.DailySyncTime,
            _tenantContextAccessor.GetCurrent().UserId,
            cancellationToken);

        return Unit.Value;
    }
}
