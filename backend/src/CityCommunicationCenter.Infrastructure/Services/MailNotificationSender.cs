using System.Net.Sockets;
using System.Text.Json;
using CityCommunicationCenter.Application.Abstractions;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

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
        var to = request.RecipientEmail?.Trim();
        if (string.IsNullOrWhiteSpace(host))
        {
            return new MailNotificationSendResult(false, "SMTP sunucu adresi zorunludur.");
        }

        if (string.IsNullOrWhiteSpace(from))
        {
            return new MailNotificationSendResult(false, "Gönderen adresi zorunludur.");
        }

        if (string.IsNullOrWhiteSpace(to))
        {
            return new MailNotificationSendResult(false, "Alıcı e-posta zorunludur.");
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
        var socketOptions = ResolveSocketOptions(request.SecurityMode, port);

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = DefaultSubject;
        message.Body = new TextPart("plain") { Text = DefaultBody };

        using var client = new SmtpClient
        {
            Timeout = 20_000,
            ServerCertificateValidationCallback = (_, _, _, _) => true,
        };

        try
        {
            await client.ConnectAsync(host, port, socketOptions, cancellationToken);
            if (request.AuthenticationEnabled)
            {
                await client.AuthenticateAsync(request.Username?.Trim(), password, cancellationToken);
            }

            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
            return new MailNotificationSendResult(true, "Deneme e-postası gönderildi.");
        }
        catch (Exception ex) when (
            ex is SmtpCommandException
            or SmtpProtocolException
            or AuthenticationException
            or SslHandshakeException
            or SocketException
            or IOException
            or FormatException
            or InvalidOperationException)
        {
            if (client.IsConnected)
            {
                try
                {
                    await client.DisconnectAsync(true, CancellationToken.None);
                }
                catch
                {
                    // ignore
                }
            }

            _logger.LogWarning(ex, "SMTP test mail failed for tenant {TenantId}", tenantId);
            return new MailNotificationSendResult(false, FormatSmtpError(ex));
        }
    }

    private static SecureSocketOptions ResolveSocketOptions(string? securityMode, int port)
    {
        if (string.Equals(securityMode, "SMTPS", StringComparison.OrdinalIgnoreCase))
        {
            return SecureSocketOptions.SslOnConnect;
        }

        if (string.Equals(securityMode, "STARTTLS", StringComparison.OrdinalIgnoreCase))
        {
            return SecureSocketOptions.StartTls;
        }

        return port is 587 or 465 ? SecureSocketOptions.StartTlsWhenAvailable : SecureSocketOptions.None;
    }

    private static string FormatSmtpError(Exception ex)
    {
        var detail = Flatten(ex);
        if (ex is AuthenticationException)
        {
            return string.IsNullOrWhiteSpace(detail)
                ? "SMTP kimlik doğrulaması başarısız. Kullanıcı adı veya parolayı kontrol edin."
                : $"SMTP kimlik doğrulaması başarısız: {detail}";
        }

        if (ex is SslHandshakeException)
        {
            return string.IsNullOrWhiteSpace(detail)
                ? "SMTP TLS bağlantısı kurulamadı. Güvenlik kipi ve portu kontrol edin."
                : $"SMTP TLS bağlantısı kurulamadı: {detail}";
        }

        if (ex is SocketException)
        {
            return string.IsNullOrWhiteSpace(detail)
                ? "SMTP sunucusuna bağlanılamadı."
                : $"SMTP sunucusuna bağlanılamadı: {detail}";
        }

        if (string.Equals(detail, "Failure sending mail.", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(detail))
        {
            return "E-posta gönderilemedi. SMTP sunucu, port, güvenlik kipi ve parolayı kontrol edin.";
        }

        return detail;
    }

    private static string Flatten(Exception ex)
    {
        var parts = new List<string>();
        for (var current = ex; current is not null; current = current.InnerException)
        {
            var text = current.Message?.Trim();
            if (string.IsNullOrWhiteSpace(text)
                || string.Equals(text, "Failure sending mail.", StringComparison.OrdinalIgnoreCase)
                || parts.Contains(text, StringComparer.OrdinalIgnoreCase))
            {
                continue;
            }

            parts.Add(text);
        }

        return string.Join(" — ", parts);
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
