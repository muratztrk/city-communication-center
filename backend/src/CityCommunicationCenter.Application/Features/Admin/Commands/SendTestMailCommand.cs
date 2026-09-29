using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Admin;

/// <summary>
/// Ayarlar > Mail Bildirimi "Test e-postası gönder". Formdaki SMTP bilgileriyle
/// Gönderen adresine deneme iletisi yollar; parola boşsa kayıtlı parola kullanılır.
/// </summary>
public sealed record SendTestMailCommand(
    Guid TenantId,
    string? SmtpHost,
    int Port,
    bool AuthenticationEnabled,
    string? Username,
    string? Password,
    bool UseStoredPassword,
    string SecurityMode,
    string? DefaultReplyTo) : ICommand<SendTestMailResult>;

public sealed record SendTestMailResult(bool Success, string Message);

public sealed class SendTestMailCommandValidator : AbstractValidator<SendTestMailCommand>
{
    private static readonly string[] ValidSecurityModes = ["None", "SMTPS", "STARTTLS"];

    public SendTestMailCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.SmtpHost).NotEmpty().WithMessage("SMTP sunucu adresi zorunludur.");
        RuleFor(command => command.Port).InclusiveBetween(1, 65535).WithMessage("Port 1-65535 arasında olmalıdır.");
        RuleFor(command => command.SecurityMode)
            .Must(mode => ValidSecurityModes.Contains(mode))
            .WithMessage("Geçersiz güvenlik kipi.");
        RuleFor(command => command.DefaultReplyTo)
            .NotEmpty()
            .WithMessage("Gönderen adresi zorunludur.")
            .EmailAddress()
            .WithMessage("Gönderen adresi geçerli bir e-posta olmalıdır.");
        When(command => command.AuthenticationEnabled, () =>
        {
            RuleFor(command => command.Username).NotEmpty().WithMessage("Kullanıcı adı zorunludur.");
        });
    }
}

public sealed class SendTestMailCommandHandler : ICommandHandler<SendTestMailCommand, SendTestMailResult>
{
    private readonly IMailNotificationSender _mailNotificationSender;

    public SendTestMailCommandHandler(IMailNotificationSender mailNotificationSender)
    {
        _mailNotificationSender = mailNotificationSender;
    }

    public async ValueTask<SendTestMailResult> Handle(SendTestMailCommand request, CancellationToken cancellationToken)
    {
        var result = await _mailNotificationSender.SendTestAsync(
            request.TenantId,
            new MailNotificationTestRequest(
                request.SmtpHost,
                request.Port,
                request.AuthenticationEnabled,
                request.Username,
                request.Password,
                request.UseStoredPassword,
                request.SecurityMode,
                request.DefaultReplyTo),
            cancellationToken);

        return new SendTestMailResult(result.Success, result.Message);
    }
}
