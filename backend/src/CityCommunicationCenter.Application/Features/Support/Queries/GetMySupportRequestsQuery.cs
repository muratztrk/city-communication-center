using System.Text.Json;
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
        var changed = false;
        foreach (var entity in requests)
        {
            var centralMessages = await _lumespecSupportClient.GetTicketMessagesAsync(
                entity.SupportRequestId,
                cancellationToken);

            var messages = centralMessages?.Messages
                .Select(message => new MySupportRequestMessageResponse(
                    message.Direction,
                    message.AuthorName,
                    message.Body,
                    message.CreatedAt))
                .ToList();

            if (messages is not null)
            {
                var threadJson = JsonSerializer.Serialize(messages);
                if (!string.Equals(entity.CentralThreadJson, threadJson, StringComparison.Ordinal))
                {
                    entity.CentralThreadJson = threadJson;
                    changed = true;
                }

                if (!string.IsNullOrWhiteSpace(centralMessages!.TicketNo)
                    && !string.Equals(entity.CentralTicketNo, centralMessages.TicketNo, StringComparison.Ordinal))
                {
                    entity.CentralTicketNo = centralMessages.TicketNo;
                    changed = true;
                }

                changed |= ApplyCentralStatus(entity, centralMessages.Status, centralMessages.UpdatedAt);
            }
            else
            {
                messages = ReadCachedMessages(entity.CentralThreadJson);
            }

            var displayStatus = entity.CentralStatus;
            response.Add(new MySupportRequestResponse(
                entity.SupportRequestId,
                entity.Subject,
                entity.Message,
                entity.PageContext,
                entity.CentralTicketNo,
                displayStatus,
                entity.CentralSyncError,
                entity.CreatedAtUtc,
                IsResolvedStatus(displayStatus) ? entity.ResolvedAtUtc : null,
                string.IsNullOrWhiteSpace(entity.Priority) ? "Normal" : entity.Priority,
                messages,
                attachmentsByRequest.GetValueOrDefault(entity.SupportRequestId) ?? []));
        }

        if (changed)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return response;
    }

    private static bool ApplyCentralStatus(SupportRequest entity, string? liveStatus, DateTimeOffset? updatedAt)
    {
        var live = liveStatus?.Trim();
        if (string.IsNullOrWhiteSpace(live))
        {
            return false;
        }

        var localResolved = IsResolvedStatus(entity.CentralStatus);
        if (localResolved && !IsResolvedStatus(live))
        {
            return false;
        }

        var changed = false;
        if (!string.Equals(entity.CentralStatus, live, StringComparison.OrdinalIgnoreCase))
        {
            entity.CentralStatus = live;
            entity.CentralSyncedAtUtc = DateTimeOffset.UtcNow;
            changed = true;
        }

        if (IsResolvedStatus(live) && entity.ResolvedAtUtc is null)
        {
            entity.ResolvedAtUtc = updatedAt ?? DateTimeOffset.UtcNow;
            changed = true;
        }

        return changed;
    }

    private static bool IsResolvedStatus(string? status)
    {
        var key = status?.Trim().ToLowerInvariant().Replace(' ', '_').Replace('-', '_') ?? string.Empty;
        return key is "resolved" or "closed" or "cancelled" or "canceled" or "solved" or "done" or "completed";
    }

    private static List<MySupportRequestMessageResponse> ReadCachedMessages(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<MySupportRequestMessageResponse>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
