using System.Text.Json;

namespace CityCommunicationCenter.Application.Features.Admin;

public sealed record UpdateMailNotificationSettingsCommand(
    Guid TenantId,
    bool IsEnabled,
    bool SmtpHostSpecified,
    string? SmtpHost,
    bool PortSpecified,
    int Port,
    bool AuthenticationEnabled,
    string? Username,
    string? Password,
    bool ClearPassword,
    string SecurityMode,
    string? DefaultReplyTo) : ICommand<Unit>;

public sealed class UpdateMailNotificationSettingsCommandValidator : AbstractValidator<UpdateMailNotificationSettingsCommand>
{
    private static readonly string[] ValidSecurityModes = ["None", "SMTPS", "STARTTLS"];

    public UpdateMailNotificationSettingsCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.SecurityMode).Must(mode => ValidSecurityModes.Contains(mode)).WithMessage("Geçersiz güvenlik kipi.");
        RuleFor(c => c.Port).InclusiveBetween(1, 65535).WithMessage("Port 1-65535 arasında olmalıdır.");

        When(c => c.IsEnabled, () =>
        {
            RuleFor(c => c.SmtpHost).NotEmpty().WithMessage("SMTP sunucu adresi zorunludur.");
        });

        When(c => c.IsEnabled && c.AuthenticationEnabled, () =>
        {
            RuleFor(c => c.Username).NotEmpty().WithMessage("Kullanıcı adı zorunludur.");
        });
    }
}

public sealed class UpdateMailNotificationSettingsCommandHandler : ICommandHandler<UpdateMailNotificationSettingsCommand, Unit>
{
    private readonly IApplicationDbContext _dbContext;

    public UpdateMailNotificationSettingsCommandHandler(IApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async ValueTask<Unit> Handle(UpdateMailNotificationSettingsCommand request, CancellationToken cancellationToken)
    {
        var setting = await _dbContext.TenantSettings
            .FirstOrDefaultAsync(s => s.TenantId == request.TenantId, cancellationToken);

        if (setting is null) return Unit.Value;

        string? existingPassword = null;
        if (!string.IsNullOrWhiteSpace(setting.MailNotificationSettingsJson))
        {
            try
            {
                var previous = JsonSerializer.Deserialize<MailPayload>(setting.MailNotificationSettingsJson);
                existingPassword = previous?.Password;
            }
            catch
            {
                existingPassword = null;
            }
        }

        var password = request.ClearPassword
            ? null
            : (string.IsNullOrEmpty(request.Password) ? existingPassword : request.Password);

        setting.MailNotificationSettingsJson = JsonSerializer.Serialize(new MailPayload
        {
            IsEnabled = request.IsEnabled,
            SmtpHostSpecified = !string.IsNullOrWhiteSpace(request.SmtpHost),
            SmtpHost = request.SmtpHost,
            PortSpecified = request.PortSpecified,
            Port = request.Port > 0 ? request.Port : 25,
            AuthenticationEnabled = request.AuthenticationEnabled,
            Username = request.Username,
            Password = password,
            SecurityMode = request.SecurityMode,
            DefaultReplyTo = request.DefaultReplyTo,
        });
        setting.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }

    private sealed class MailPayload
    {
        public bool IsEnabled { get; set; }
        public bool SmtpHostSpecified { get; set; }
        public string? SmtpHost { get; set; }
        public bool PortSpecified { get; set; }
        public int Port { get; set; } = 25;
        public bool AuthenticationEnabled { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        public string SecurityMode { get; set; } = "None";
        public string? DefaultReplyTo { get; set; }
    }
}
