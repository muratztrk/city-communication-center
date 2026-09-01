using CityCommunicationCenter.Application.Common;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateCitizenAutoReplyTemplatesCommand(
    Guid TenantId,
    string ProcessingReceived,
    string InProgress,
    string Completed,
    string Cancelled,
    string? Greeting = null,
    string? AfterHoursManagerSms = null,
    CitizenAutoReplyGreetingsContract? Greetings = null,
    string? AfterHoursStaffSms = null,
    bool AfterHoursManagerSmsEnabled = true,
    bool AfterHoursStaffSmsEnabled = false) : ICommand<Unit>;

public sealed class UpdateCitizenAutoReplyTemplatesCommandValidator : AbstractValidator<UpdateCitizenAutoReplyTemplatesCommand>
{
    public UpdateCitizenAutoReplyTemplatesCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.ProcessingReceived).NotEmpty().MaximumLength(1000);
        RuleFor(command => command.InProgress).NotEmpty().MaximumLength(1000);
        RuleFor(command => command.Completed).NotEmpty().MaximumLength(1000);
        RuleFor(command => command.Cancelled).NotEmpty().MaximumLength(1000);
        RuleFor(command => command.Greeting).MaximumLength(200);
        RuleFor(command => command.AfterHoursManagerSms).MaximumLength(1600);
        RuleFor(command => command.AfterHoursStaffSms).MaximumLength(1600);
        When(command => command.Greetings is not null, () =>
        {
            RuleFor(command => command.Greetings!.ProcessingReceived).MaximumLength(200);
            RuleFor(command => command.Greetings!.InProgress).MaximumLength(200);
            RuleFor(command => command.Greetings!.Completed).MaximumLength(200);
            RuleFor(command => command.Greetings!.Cancelled).MaximumLength(200);
        });
    }
}

public sealed class UpdateCitizenAutoReplyTemplatesCommandHandler : ICommandHandler<UpdateCitizenAutoReplyTemplatesCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public UpdateCitizenAutoReplyTemplatesCommandHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<Unit> Handle(UpdateCitizenAutoReplyTemplatesCommand request, CancellationToken cancellationToken)
    {
        var actorUserId = _tenantContextAccessor.GetCurrent().UserId;
        var settings = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(entity => entity.TenantId == request.TenantId, cancellationToken);

        if (settings is null)
        {
            settings = new TenantSetting
            {
                TenantSettingId = Guid.NewGuid(),
                TenantId = request.TenantId,
                CreatedByUserId = actorUserId,
            };
            _dbContext.TenantSettings.Add(settings);
        }
        else
        {
            settings.UpdatedByUserId = actorUserId;
            settings.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }

        settings.CitizenAutoReplyTemplatesJson = CitizenAutoReplyTemplateJson.Serialize(new CitizenAutoReplyTemplateModel(
            request.ProcessingReceived.Trim(),
            request.InProgress.Trim(),
            request.Completed.Trim(),
            request.Cancelled.Trim(),
            CitizenOutboundGreeting.NormalizeLine(request.Greeting),
            request.AfterHoursManagerSms,
            request.Greetings is null
                ? null
                : new CitizenAutoReplyGreetings(
                    request.Greetings.ProcessingReceived,
                    request.Greetings.InProgress,
                    request.Greetings.Completed,
                    request.Greetings.Cancelled),
            request.AfterHoursStaffSms,
            request.AfterHoursManagerSmsEnabled,
            request.AfterHoursStaffSmsEnabled));

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
