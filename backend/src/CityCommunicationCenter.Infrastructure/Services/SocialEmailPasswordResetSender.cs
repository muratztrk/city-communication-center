using System.Net;
using System.Net.Mail;

namespace CityCommunicationCenter.Infrastructure.Services;

/// <summary>
/// Sends password-reset e-mails through the SMTP credentials stored on the tenant's
/// social "Email" channel configuration.
/// </summary>
internal sealed class SocialEmailPasswordResetSender : IPasswordResetEmailSender
{
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly ILogger<SocialEmailPasswordResetSender> _logger;

    public SocialEmailPasswordResetSender(
        ISocialMediaSettingsProvider settingsProvider,
        ILogger<SocialEmailPasswordResetSender> logger)
    {
        _settingsProvider = settingsProvider;
        _logger = logger;
    }

    public async Task<bool> SendNewPasswordAsync(
        Guid tenantId,
        string toEmail,
        string? displayName,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        var email = _settingsProvider.GetSettings(tenantId)?.Email;
        if (email is null
            || string.IsNullOrWhiteSpace(email.SmtpHost)
            || string.IsNullOrWhiteSpace(email.SmtpUser)
            || string.IsNullOrWhiteSpace(email.SmtpPassword))
        {
            _logger.LogWarning(
                "Password reset requested for tenant {TenantId} but the Email channel SMTP settings are not configured.",
                tenantId);
            return false;
        }

        var port = int.TryParse(email.SmtpPort, out var parsedPort) && parsedPort > 0 ? parsedPort : 587;
        var greetingName = string.IsNullOrWhiteSpace(displayName) ? toEmail : displayName;

        using var client = new SmtpClient(email.SmtpHost, port)
        {
            Credentials = new NetworkCredential(email.SmtpUser, email.SmtpPassword),
            EnableSsl = true,
        };

        using var message = new MailMessage(email.SmtpUser, toEmail)
        {
            Subject = "Parola Sıfırlama",
            Body =
                $"Sayın {greetingName},\n\n" +
                "Hesabınızın parolası sıfırlandı. Yeni geçici parolanız:\n\n" +
                $"{newPassword}\n\n" +
                "Güvenliğiniz için giriş yaptıktan sonra parolanızı değiştirmenizi öneririz.",
        };

        try
        {
            await client.SendMailAsync(message, cancellationToken);
            return true;
        }
        catch (Exception ex) when (ex is SmtpException or InvalidOperationException or IOException)
        {
            _logger.LogError(ex, "Failed to send the password reset e-mail for tenant {TenantId}.", tenantId);
            return false;
        }
    }
}
