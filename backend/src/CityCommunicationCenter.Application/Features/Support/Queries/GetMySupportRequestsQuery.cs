using CityCommunicationCenter.Shared.Contracts;

namespace CityCommunicationCenter.Application.Features.Support;

public sealed record MySupportRequestMessageResponse(
    string Direction,
    string? AuthorName,
    string Body,
    DateTimeOffset CreatedAt);

public sealed record MySupportRequestResponse(
    Guid SupportRequestId,
    string Subject,
    string Message,
    string? PageContext,
    string? CentralTicketNo,
    string? CentralStatus,
    string? CentralSyncError,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ResolvedAtUtc,
    string Priority,
    IReadOnlyList<MySupportRequestMessageResponse> Messages,
    IReadOnlyList<AttachmentResponse> Attachments);

public sealed record GetMySupportRequestsQuery() : IQuery<IReadOnlyList<MySupportRequestResponse>>;

public sealed class GetMySupportRequestsQueryHandler : IQueryHandler<GetMySupportRequestsQuery, IReadOnlyList<MySupportRequestResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ILumespecSupportClient _lumespecSupportClient;

    public GetMySupportRequestsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ILumespecSupportClient lumespecSupportClient)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _lumespecSupportClient = lumespecSupportClient;
    }

    public async ValueTask<IReadOnlyList<MySupportRequestResponse>> Handle(
        GetMySupportRequestsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var query = _dbContext.SupportRequests
            .Where(entity => entity.TenantId == tenantId);

        query = context.UserId.HasValue
            ? query.Where(entity => entity.CreatedByUserId == context.UserId.Value)
            : query.Where(entity => entity.CreatedByUserId == null);

        var requests = await query
            .OrderByDescending(entity => entity.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var requestIds = requests.Select(entity => entity.SupportRequestId).ToList();
        var attachments = await _dbContext.Attachments
            .AsNoTracking()
            .Where(attachment =>
                attachment.TenantId == tenantId
                && attachment.EntityType == "SupportRequest"
                && requestIds.Contains(attachment.EntityId))
            .OrderBy(attachment => attachment.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var attachmentsByRequest = attachments
            .GroupBy(attachment => attachment.EntityId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<AttachmentResponse>)group
                    .Select(attachment => new AttachmentResponse(
                        attachment.AttachmentId,
                        attachment.FileName,
                        attachment.ContentType,
                        attachment.FileSizeBytes,
                        attachment.RelativeUrl,
                        attachment.CreatedAtUtc))
                    .ToList());

        var response = new List<MySupportRequestResponse>(requests.Count);
        foreach (var entity in requests)
        {
            var centralMessages = await _lumespecSupportClient.GetTicketMessagesAsync(
                entity.SupportRequestId,
                cancellationToken);

            var displayStatus = string.Equals(entity.CentralStatus, "resolved", StringComparison.OrdinalIgnoreCase)
                ? entity.CentralStatus
                : centralMessages?.Status ?? entity.CentralStatus;

            response.Add(new MySupportRequestResponse(
                entity.SupportRequestId,
                entity.Subject,
                entity.Message,
                entity.PageContext,
                centralMessages?.TicketNo ?? entity.CentralTicketNo,
                displayStatus,
                entity.CentralSyncError,
                entity.CreatedAtUtc,
                string.Equals(displayStatus, "resolved", StringComparison.OrdinalIgnoreCase)
                    ? entity.ResolvedAtUtc
                    : null,
                string.IsNullOrWhiteSpace(entity.Priority) ? "Normal" : entity.Priority,
                centralMessages?.Messages
                    .Select(message => new MySupportRequestMessageResponse(
                        message.Direction,
                        message.AuthorName,
                        message.Body,
                        message.CreatedAt))
                    .ToList() ?? [],
                attachmentsByRequest.GetValueOrDefault(entity.SupportRequestId) ?? []));
        }

        return response;
    }
}
