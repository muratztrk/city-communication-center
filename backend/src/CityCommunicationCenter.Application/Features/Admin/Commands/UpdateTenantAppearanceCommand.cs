using Microsoft.Extensions.Localization;
using System.Text.RegularExpressions;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateTenantAppearanceCommand(
    Guid TenantId,
    string ThemePreset,
    string PrimaryColor,
    string SecondaryColor,
    string AccentColor,
    string NeutralColor,
    string SurfaceColor,
    string BackgroundColor,
    string HeaderGradientFrom,
    string HeaderGradientTo,
    string SidebarBackgroundColor,
    string SidebarForegroundColor,
    string? LogoUrl,
    string? LoginBackgroundImageUrl) : ICommand<Unit>;

public sealed partial class UpdateTenantAppearanceCommandValidator : AbstractValidator<UpdateTenantAppearanceCommand>
{
    public UpdateTenantAppearanceCommandValidator(IStringLocalizer<ApplicationResource> localizer)
    {
        RuleFor(command => command.TenantId)
            .NotEmpty();

        RuleFor(command => command.ThemePreset)
            .NotEmpty()
            .MaximumLength(100)
            .WithMessage(localizer["ValidationAppearanceThemePresetRequired"]);

        RuleFor(command => command.PrimaryColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.SecondaryColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.AccentColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.NeutralColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.SurfaceColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.BackgroundColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.HeaderGradientFrom).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.HeaderGradientTo).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.SidebarBackgroundColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
        RuleFor(command => command.SidebarForegroundColor).Must(BeHexColor).WithMessage(localizer["ValidationAppearanceHexColor"]);
    }

    private static bool BeHexColor(string value)
        => !string.IsNullOrWhiteSpace(value) && HexColorRegex().IsMatch(value.Trim());

    [GeneratedRegex("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")]
    private static partial Regex HexColorRegex();
}

public sealed class UpdateTenantAppearanceCommandHandler : ICommandHandler<UpdateTenantAppearanceCommand, Unit>
{
    private readonly ITenantAppearanceService _tenantAppearanceService;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateTenantAppearanceCommandHandler(ITenantAppearanceService tenantAppearanceService, ITenantContextAccessor tenantContextAccessor)
    {
        _tenantAppearanceService = tenantAppearanceService;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateTenantAppearanceCommand request, CancellationToken cancellationToken)
    {
        var actorUserId = _tenantContextAccessor.GetCurrent().UserId;

        await _tenantAppearanceService.SaveSettingsAsync(
            request.TenantId,
            new TenantAppearanceUpdate(
                request.ThemePreset,
                request.PrimaryColor,
                request.SecondaryColor,
                request.AccentColor,
                request.NeutralColor,
                request.SurfaceColor,
                request.BackgroundColor,
                request.HeaderGradientFrom,
                request.HeaderGradientTo,
                request.SidebarBackgroundColor,
                request.SidebarForegroundColor,
                request.LogoUrl,
                request.LoginBackgroundImageUrl),
            actorUserId,
            cancellationToken);

        return Unit.Value;
    }
}
