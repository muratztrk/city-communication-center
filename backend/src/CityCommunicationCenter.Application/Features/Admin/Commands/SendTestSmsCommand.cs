namespace CityCommunicationCenter.Application.Features.Admin;

/// <summary>
/// Ayarlar > SMS API ekranındaki "Test SMS Gönder". Kayıtlı ayarları kullanır; "SMS Gönderimi
/// Aktif" kapalıyken de çalışır ki yönetici canlıya almadan kullanıcı/parola/başlık doğrulayabilsin.
/// </summary>
public sealed record SendTestSmsCommand(Guid TenantId, string PhoneNumber, string? Text)
    : ICommand<SendTestSmsResult>;

public sealed record SendTestSmsResult(bool Success, string Message);

public sealed class SendTestSmsCommandValidator : AbstractValidator<SendTestSmsCommand>
{
    public SendTestSmsCommandValidator()
    {
        RuleFor(command => command.TenantId).NotEmpty();
        RuleFor(command => command.PhoneNumber)
            .NotEmpty()
            .WithMessage("Test için telefon numarası zorunludur.");
    }
}

public sealed class SendTestSmsCommandHandler : ICommandHandler<SendTestSmsCommand, SendTestSmsResult>
{
    private const string DefaultText = "Tire İletişim Merkezi SMS ayar testi.";

    private readonly ISmsGateway _smsGateway;

    public SendTestSmsCommandHandler(ISmsGateway smsGateway)
    {
        _smsGateway = smsGateway;
    }

    public async ValueTask<SendTestSmsResult> Handle(SendTestSmsCommand request, CancellationToken cancellationToken)
    {
        var text = string.IsNullOrWhiteSpace(request.Text) ? DefaultText : request.Text.Trim();
        var result = await _smsGateway.SendTestAsync(
            request.TenantId,
            request.PhoneNumber,
            text,
            new SmsSendContext(SmsOutboundKind.Test),
            cancellationToken);

        return new SendTestSmsResult(
            result.Success,
            result.Message ?? (result.Success ? "SMS başarıyla gönderildi." : "SMS gönderilemedi."));
    }
}
