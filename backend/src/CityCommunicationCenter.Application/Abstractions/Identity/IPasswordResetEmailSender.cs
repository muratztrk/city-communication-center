namespace CityCommunicationCenter.Application.Abstractions.Identity;

/// <summary>
/// Sends a freshly generated password to a local user. The transport reuses the
/// tenant's configured social "Email" channel SMTP credentials.
/// </summary>
public interface IPasswordResetEmailSender
{
    /// <returns><c>true</c> when the e-mail was sent; <c>false</c> when SMTP is not
    /// configured for the tenant or delivery failed.</returns>
    Task<bool> SendNewPasswordAsync(
        Guid tenantId,
        string toEmail,
        string? displayName,
        string newPassword,
        CancellationToken cancellationToken = default);
}
