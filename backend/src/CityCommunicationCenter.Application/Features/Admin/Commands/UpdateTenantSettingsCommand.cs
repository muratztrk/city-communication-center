namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateTenantSettingsCommand(
    Guid TenantId,
    Guid? ActorUserId,
    string DisplayName,
    string? Theme,
    string? Domain,
    int DefaultSlaHours) : ICommand<Unit>;

public sealed class UpdateTenantSettingsCommandValidator : AbstractValidator<UpdateTenantSettingsCommand>
{
    public UpdateTenantSettingsCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.DisplayName)
            .NotEmpty()
            .WithMessage("Gorunen ad zorunludur.")
            .MaximumLength(200);
        RuleFor(command => command.DefaultSlaHours)
            .GreaterThan(0)
            .WithMessage("Varsayilan SLA suresi sifirdan buyuk olmalidir.");
    }
}

public sealed class UpdateTenantSettingsCommandHandler : IRequestHandler<UpdateTenantSettingsCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateTenantSettingsCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Unit> Handle(UpdateTenantSettingsCommand request, CancellationToken cancellationToken)
    {
        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        if (settings is null)
        {
            settings = new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = request.TenantId,
                CreatedByUserId = request.ActorUserId
            };

            _dbContext.TenantSettings.Add(settings);
        }
        else
        {
            settings.UpdatedByUserId = request.ActorUserId;
            settings.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        settings.DisplayName = request.DisplayName.Trim();
        settings.Theme = string.IsNullOrWhiteSpace(request.Theme) ? null : request.Theme.Trim();
        settings.Domain = string.IsNullOrWhiteSpace(request.Domain) ? null : request.Domain.Trim();
        settings.DefaultSlaHours = request.DefaultSlaHours;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}