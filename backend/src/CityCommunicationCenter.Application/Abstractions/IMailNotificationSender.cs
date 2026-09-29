namespace CityCommunicationCenter.Application.Abstractions;

public interface IMailNotificationSender
{
    Task<MailNotificationSendResult> SendTestAsync(
        Guid tenantId,
        MailNotificationTestRequest request,
        CancellationToken cancellationToken = default);
}

public sealed record MailNotificationTestRequest(
    string? SmtpHost,
    int Port,
    bool AuthenticationEnabled,
    string? Username,
    string? Password,
    bool UseStoredPassword,
    string SecurityMode,
    string? DefaultReplyTo,
    string? RecipientEmail);

public sealed record MailNotificationSendResult(bool Success, string Message);
