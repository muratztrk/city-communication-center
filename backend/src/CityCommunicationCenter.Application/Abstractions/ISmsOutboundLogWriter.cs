namespace CityCommunicationCenter.Application.Abstractions;

public sealed record SmsOutboundLogEntry(
    Guid TenantId,
    SmsSendContext Context,
    string RecipientPhoneMasked,
    string Text,
    bool Success,
    string? Provider,
    string? ProviderCode,
    string? ProviderMessage);

public interface ISmsOutboundLogWriter
{
    Task WriteAsync(SmsOutboundLogEntry entry, CancellationToken cancellationToken = default);
}
