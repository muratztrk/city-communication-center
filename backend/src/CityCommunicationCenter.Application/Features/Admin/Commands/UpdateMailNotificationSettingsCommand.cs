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
    string? DefaultReplyTo,
    string? IncomingSubjectTemplate = null,
    string? IncomingBodyTemplate = null,
    bool? ExcludedUsersEnabled = null,
    IReadOnlyList<Guid>? ExcludedUserIds = null,
    bool? OverdueMailEnabled = null,
    string? OverdueSubjectTemplate = null,
    string? OverdueBodyTemplate = null,
    bool? OverdueTaskMailEnabled = null,
    string? OverdueTaskSubjectTemplate = null,
    string? OverdueTaskBodyTemplate = null) : ICommand<Unit>;

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

        var previous = MailNotificationSettingsPayload.ParseOrEmpty(setting.MailNotificationSettingsJson);
        var password = request.ClearPassword
            ? null
            : (string.IsNullOrEmpty(request.Password) ? previous.Password : request.Password);

        setting.MailNotificationSettingsJson = JsonSerializer.Serialize(new MailNotificationSettingsPayload
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
            IncomingSubjectTemplate = request.IncomingSubjectTemplate
                ?? previous.IncomingSubjectTemplate
                ?? MailNotificationSettingsPayload.RequestNoToken,
            IncomingBodyTemplate = request.IncomingBodyTemplate
                ?? previous.IncomingBodyTemplate
                ?? MailNotificationSettingsPayload.RequestNoToken,
            ExcludedUsersEnabled = request.ExcludedUsersEnabled ?? previous.ExcludedUsersEnabled,
            ExcludedUserIds = request.ExcludedUserIds?.ToArray() ?? previous.ExcludedUserIds ?? [],
            OverdueMailEnabled = request.OverdueMailEnabled ?? previous.OverdueMailEnabled,
            OverdueSubjectTemplate = request.OverdueSubjectTemplate
                ?? previous.OverdueSubjectTemplate
                ?? MailNotificationSettingsPayload.RequestNoToken,
            OverdueBodyTemplate = request.OverdueBodyTemplate
                ?? previous.OverdueBodyTemplate
                ?? MailNotificationSettingsPayload.RequestNoToken,
            OverdueTaskMailEnabled = request.OverdueTaskMailEnabled ?? previous.OverdueTaskMailEnabled,
            OverdueTaskSubjectTemplate = request.OverdueTaskSubjectTemplate
                ?? previous.OverdueTaskSubjectTemplate
                ?? MailNotificationSettingsPayload.RequestNoToken,
            OverdueTaskBodyTemplate = request.OverdueTaskBodyTemplate
                ?? previous.OverdueTaskBodyTemplate
                ?? MailNotificationSettingsPayload.RequestNoToken,
        });
        setting.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Unit.Value;
    }
}
