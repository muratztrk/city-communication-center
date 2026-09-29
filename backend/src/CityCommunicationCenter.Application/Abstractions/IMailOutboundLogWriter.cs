namespace CityCommunicationCenter.Application.Abstractions;

public sealed record MailOutboundLogEntry(
    Guid TenantId,
    MailSendContext Context,
    string RecipientEmail,
    string Subject,
    string Body,
    bool Success,
    string? ErrorMessage);

public interface IMailOutboundLogWriter
{
    Task WriteAsync(MailOutboundLogEntry entry, CancellationToken cancellationToken = default);
}
