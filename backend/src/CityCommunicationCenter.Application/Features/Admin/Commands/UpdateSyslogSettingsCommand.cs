using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateSyslogSettingsCommand(
    Guid TenantId,
    bool IsEnabled,
    string? Host,
    int Port,
    string Format,
    string Transport) : ICommand<Unit>;

public sealed class UpdateSyslogSettingsCommandValidator : AbstractValidator<UpdateSyslogSettingsCommand>
{
    private static readonly string[] ValidFormats = ["Syslog", "CEF"];
    private static readonly string[] ValidTransports = ["UDP", "TCP"];

    public UpdateSyslogSettingsCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();

        When(c => c.IsEnabled, () =>
        {
            RuleFor(c => c.Host).NotEmpty().WithMessage("Sunucu adresi zorunludur.");
            RuleFor(c => c.Port).InclusiveBetween(1, 65535).WithMessage("Port 1-65535 arasında olmalıdır.");
            RuleFor(c => c.Format).Must(f => ValidFormats.Contains(f)).WithMessage("Geçersiz format.");
            RuleFor(c => c.Transport).Must(t => ValidTransports.Contains(t)).WithMessage("Geçersiz aktarım.");
        });
    }
}

public sealed class UpdateSyslogSettingsCommandHandler : ICommandHandler<UpdateSyslogSettingsCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateSyslogSettingsCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<Unit> Handle(UpdateSyslogSettingsCommand request, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);

        if (setting is null) return Unit.Value;

        setting.SyslogSettingsJson = JsonSerializer.Serialize(new
        {
            request.IsEnabled,
            request.Host,
            request.Port,
            request.Format,
            request.Transport,
        });

        setting.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
