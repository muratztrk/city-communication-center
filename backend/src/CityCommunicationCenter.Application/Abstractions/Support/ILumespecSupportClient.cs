namespace CityCommunicationCenter.Application.Abstractions.Support;

public sealed record CentralSupportAttachmentPayload(
    string FileName,
    string ContentType,
    string ContentBase64);

public sealed record CreateCentralSupportTicketRequest(
    Guid SupportRequestId,
    Guid TenantId,
    string? TenantName,
    Guid? RequesterUserId,
    string RequesterName,
    string? RequesterEmail,
    string? RequesterPhone,
    string? DepartmentName,
    string Subject,
    string Message,
    string? PageContext,
    string? Priority,
    string? PriorityLabel,
    IReadOnlyList<CentralSupportAttachmentPayload> Attachments);

public sealed record CentralSupportTicketResult(
    string TicketNo,
    string Status);

public sealed record CentralSupportTicketMessagesResult(
    string TicketNo,
    string Status,
    DateTimeOffset? UpdatedAt,
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
