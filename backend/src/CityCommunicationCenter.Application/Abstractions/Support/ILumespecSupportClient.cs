namespace CityCommunicationCenter.Application.Abstractions.Support;

public sealed record CreateCentralSupportTicketRequest(
    Guid SupportRequestId,
    Guid TenantId,
    string? TenantName,
    Guid? RequesterUserId,
    string RequesterName,
    string? RequesterEmail,
    string Subject,
    string Message,
    string? PageContext);

public sealed record CentralSupportTicketResult(
    string TicketNo,
    string Status);

public sealed record CentralSupportTicketMessagesResult(
    string TicketNo,
    string Status,
    IReadOnlyList<CentralSupportTicketMessage> Messages);

public sealed record CentralSupportTicketMessage(
    string Direction,
    string? AuthorName,
    string Body,
    DateTimeOffset CreatedAt);

public interface ILumespecSupportClient
{
    Task<CentralSupportTicketResult?> CreateTicketAsync(
        CreateCentralSupportTicketRequest request,
        CancellationToken cancellationToken);

    Task<CentralSupportTicketMessagesResult?> GetTicketMessagesAsync(
        Guid supportRequestId,
        CancellationToken cancellationToken);
}
