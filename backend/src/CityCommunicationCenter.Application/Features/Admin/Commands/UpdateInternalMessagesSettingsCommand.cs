using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateInternalMessagesSettingsCommand(
    Guid TenantId,
    bool ShowUserTitleInMessages) : ICommand<Unit>;

public sealed class UpdateInternalMessagesSettingsCommandValidator : AbstractValidator<UpdateInternalMessagesSettingsCommand>
{
    public UpdateInternalMessagesSettingsCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
    }
}

public sealed class UpdateInternalMessagesSettingsCommandHandler : ICommandHandler<UpdateInternalMessagesSettingsCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateInternalMessagesSettingsCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<Unit> Handle(UpdateInternalMessagesSettingsCommand request, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(item => item.TenantId == request.TenantId, cancellationToken);

        if (setting is null) return Unit.Value;

        setting.InternalMessagesSettingsJson = JsonSerializer.Serialize(new
        {
            ShowUserTitleInMessages = request.ShowUserTitleInMessages,
        });
        setting.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
