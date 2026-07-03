namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetCitizenConversationDetailQuery(Guid CitizenConversationId)
    : IQuery<CitizenConversationDetailDto?>;

public sealed class GetCitizenConversationDetailQueryHandler
    : IQueryHandler<GetCitizenConversationDetailQuery, CitizenConversationDetailDto?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenConversationDetailQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<CitizenConversationDetailDto?> Handle(
        GetCitizenConversationDetailQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var conversation = await _dbContext.CitizenConversations
            .AsNoTracking()
            .Where(c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId)
            .Select(c => new
            {
                c.CitizenConversationId,
                c.CitizenPhone,
                c.CitizenName,
                c.Label,
                c.Neighborhood,
                c.Street,
                c.OpenAddress,
                c.LastMessageAt,
                c.UnreadCount,
                c.IsBlocked
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null) return null;

        var tenantName = await _dbContext.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";

        var citizenPhoneLabel = ConversationEntrySenderLabelHelper.FormatCitizenPhone(
            conversation.CitizenPhone,
            conversation.CitizenPhone);

        var messageIds = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId == request.CitizenConversationId)
            .Select(m => m.SocialMessageId)
            .ToListAsync(cancellationToken);

        var rawTimeline = await _dbContext.ConversationEntries
            .AsNoTracking()
            .Where(e => messageIds.Contains(e.SocialMessageId))
            .OrderBy(e => e.SentAt)
            .Select(e => new
            {
                e.EntryId,
                Direction = e.Direction.ToString(),
                e.Content,
                e.MediaId,
                e.MediaMimeType,
                e.SentAt,
                e.SocialMessageId,
                e.SenderLabel,
                DeliveryStatus = e.DeliveryStatus.HasValue ? e.DeliveryStatus.Value.ToString() : null,
                e.DeliveryError,
                e.EditedAtUtc,
            })
            .ToListAsync(cancellationToken);

        var terminalInfoByMessageId = await ResolveTerminalInfoByMessageIdAsync(
            tenantId,
            messageIds,
            cancellationToken);

        var timeline = rawTimeline
            .Select(e =>
            {
                terminalInfoByMessageId.TryGetValue(e.SocialMessageId, out var terminalInfo);
                return new CitizenConversationTimelineEntryDto(
                    e.EntryId,
                    e.Direction,
                    e.Content,
                    e.MediaId,
                    e.MediaMimeType,
                    e.SentAt,
                    e.SocialMessageId,
                    e.SenderLabel
                        ?? (e.Direction == ConversationEntryDirection.Inbound.ToString()
                            ? citizenPhoneLabel
                            : tenantName),
                    e.DeliveryStatus,
                    e.DeliveryError,
                    e.EditedAtUtc,
                    e.DeliveryStatus == ConversationDeliveryStatus.Pending.ToString() ? terminalInfo?.Status : null,
                    e.DeliveryStatus == ConversationDeliveryStatus.Pending.ToString() ? terminalInfo?.Note : null);
            })
            .ToList();

        var lastInboundAt = timeline
            .Where(e => e.Direction == "Inbound")
            .Select(e => (DateTimeOffset?)e.SentAt)
            .LastOrDefault();

        var tickets = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId == request.CitizenConversationId)
            .OrderBy(m => m.ReceivedAtUtc)
            .Select(m => new CitizenConversationTicketDto(
                m.SocialMessageId,
                m.Status.ToString(),
                m.ReceivedAtUtc,
                m.JobId,
                m.Category,
                m.CitizenRequestNumber,
                m.CitizenRequestNumberYear,
                m.Job != null ? m.Job.Priority : null,
                m.Job != null ? m.Job.JobNumber : null,
                m.Job != null ? m.Job.JobNumberYear : null))
            .ToListAsync(cancellationToken);

        var statusCounts = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId == request.CitizenConversationId && m.Job != null)
            .GroupBy(m => m.Job!.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var intakeCount = statusCounts
            .Where(s => s.Status is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested)
            .Sum(s => s.Count);
        var inProgressCount = statusCounts.Where(s => s.Status == JobStatus.Active).Sum(s => s.Count);
        var completedCount = statusCounts.Where(s => s.Status == JobStatus.Completed).Sum(s => s.Count);
        var cancelledCount = statusCounts.Where(s => s.Status is JobStatus.Cancelled or JobStatus.Rejected).Sum(s => s.Count);

        return new CitizenConversationDetailDto(
            conversation.CitizenConversationId,
            conversation.CitizenPhone,
            conversation.CitizenName,
            conversation.Label,
            conversation.Neighborhood,
            conversation.Street,
            conversation.OpenAddress,
            conversation.LastMessageAt,
            conversation.UnreadCount,
            conversation.IsBlocked,
            intakeCount,
            inProgressCount,
            completedCount,
            cancelledCount,
            lastInboundAt,
            timeline,
            tickets);
    }

    private async Task<Dictionary<Guid, TerminalInfo>> ResolveTerminalInfoByMessageIdAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> messageIds,
        CancellationToken cancellationToken)
    {
        var linkedMessages = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => messageIds.Contains(m.SocialMessageId))
            .Select(m => new { m.SocialMessageId, m.JobId })
            .ToListAsync(cancellationToken);

        var result = new Dictionary<Guid, TerminalInfo>();
        foreach (var linkedMessage in linkedMessages)
        {
            var job = await _dbContext.Jobs
                .AsNoTracking()
                .Where(j => j.TenantId == tenantId
                    && (linkedMessage.JobId.HasValue
                        ? j.JobId == linkedMessage.JobId.Value
                        : j.SourceRefId == linkedMessage.SocialMessageId))
                .Select(j => new { j.JobId, j.Status, j.CancelReason })
                .FirstOrDefaultAsync(cancellationToken);

            if (job is null || job.Status is not (JobStatus.Completed or JobStatus.Cancelled))
            {
                continue;
            }

            if (job.Status == JobStatus.Completed)
            {
                var completionNote = await _dbContext.Tasks
                    .AsNoTracking()
                    .Where(t => t.TenantId == tenantId && t.JobId == job.JobId && t.CompletedAtUtc != null)
                    .OrderByDescending(t => t.CompletedAtUtc)
                    .Select(t => t.Notes)
                    .FirstOrDefaultAsync(cancellationToken);
                result[linkedMessage.SocialMessageId] = new TerminalInfo(JobStatus.Completed.ToString(), completionNote);
                continue;
            }

            var cancelNote = !string.IsNullOrWhiteSpace(job.CancelReason)
                ? job.CancelReason
                : await _dbContext.Tasks
                    .AsNoTracking()
                    .Where(t => t.TenantId == tenantId
                        && t.JobId == job.JobId
                        && t.CurrentStatus == CityCommunicationCenter.Domain.Enums.TaskStatus.Cancelled)
                    .OrderByDescending(t => t.UpdatedAtUtc)
                    .Select(t => t.RevisionReason)
                    .FirstOrDefaultAsync(cancellationToken);
            result[linkedMessage.SocialMessageId] = new TerminalInfo(JobStatus.Cancelled.ToString(), cancelNote);
        }

        return result;
    }

    private sealed record TerminalInfo(string? Status, string? Note);
}
