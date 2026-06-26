namespace CityCommunicationCenter.Application.Abstractions;

public interface IWhatsAppTemplateAutoReplyService
{
    Task ScheduleForInboundMessageAsync(
        Guid tenantId,
        Guid socialMessageId,
        string citizenHandle,
        string inboundContent,
        DateTimeOffset receivedAtUtc,
        CancellationToken cancellationToken = default);
}
