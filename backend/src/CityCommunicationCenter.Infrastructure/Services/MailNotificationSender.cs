using System.Net;
using System.Net.Mail;
using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Infrastructure.Services;

internal sealed class MailNotificationSender : IMailNotificationSender
{
    private const string DefaultSubject = "Tire İletişim Merkezi SMTP ayar testi.";
    private const string DefaultBody =
        "Bu ileti, Ayarlar > Mail Bildirimi ekranındaki deneme e-postasıdır. SMTP sunucusu çalışıyor.";

    private readonly IApplicationDbContext _dbContext;
    private readonly ILogger<MailNotificationSender> _logger;

    public MailNotificationSender(IApplicationDbContext dbContext, ILogger<MailNotificationSender> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<MailNotificationSendResult> SendTestAsync(
        Guid tenantId,
        MailNotificationTestRequest request,
        CancellationToken cancellationToken = default)
    {
        var host = request.SmtpHost?.Trim();
        var from = request.DefaultReplyTo?.Trim();
        if (string.IsNullOrWhiteSpace(host))
        {
            return new MailNotificationSendResult(false, "SMTP sunucu adresi zorunludur.");
        }

        if (string.IsNullOrWhiteSpace(from))
        {
            return new MailNotificationSendResult(false, "Gönderen adresi zorunludur.");
        }

        var password = request.Password;
        if (request.UseStoredPassword || string.IsNullOrEmpty(password))
        {
            password = await ReadStoredPasswordAsync(tenantId, cancellationToken);
        }

        if (request.AuthenticationEnabled && string.IsNullOrWhiteSpace(password))
        {
            return new MailNotificationSendResult(false, "Parola zorunludur.");
        }

        var port = request.Port > 0 ? request.Port : 25;
        var enableSsl = !string.Equals(request.SecurityMode, "None", StringComparison.OrdinalIgnoreCase);

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            Timeout = 20_000,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
        };

        if (request.AuthenticationEnabled)
        {
            client.Credentials = new NetworkCredential(request.Username?.Trim(), password);
        }

        using var message = new MailMessage(from, from)
        {
            Subject = DefaultSubject,
            Body = DefaultBody,
        };

        try
        {
            await client.SendMailAsync(message, cancellationToken);
            return new MailNotificationSendResult(true, "Deneme e-postası gönderildi.");
        }
        catch (Exception ex) when (ex is SmtpException or InvalidOperationException or IOException or FormatException)
        {
            _logger.LogWarning(ex, "SMTP test mail failed for tenant {TenantId}", tenantId);
            var detail = string.IsNullOrWhiteSpace(ex.Message) ? "E-posta gönderilemedi." : ex.Message;
            return new MailNotificationSendResult(false, detail);
        }
    }

    private async Task<string?> ReadStoredPasswordAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var json = await _dbContext.TenantSettings
            .AsNoTracking()
            .Where(setting => setting.TenantId == tenantId)
            .Select(setting => setting.MailNotificationSettingsJson)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            var payload = JsonSerializer.Deserialize<StoredMailPayload>(json);
            return payload?.Password;
        }
        catch
        {
            return null;
        }
    }

    private sealed class StoredMailPayload
    {
        public string? Password { get; set; }
    }
}
