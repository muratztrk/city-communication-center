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
            .Select(c => new { c.CitizenConversationId, c.CitizenPhone, c.CitizenName, c.LastMessageAt, c.UnreadCount, c.IsBlocked })
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
            })
            .ToListAsync(cancellationToken);

        var timeline = rawTimeline
            .Select(e => new CitizenConversationTimelineEntryDto(
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
                e.DeliveryError))
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

        return new CitizenConversationDetailDto(
            conversation.CitizenConversationId,
            conversation.CitizenPhone,
            conversation.CitizenName,
            conversation.LastMessageAt,
            conversation.UnreadCount,
            conversation.IsBlocked,
            lastInboundAt,
            timeline,
            tickets);
    }
}
