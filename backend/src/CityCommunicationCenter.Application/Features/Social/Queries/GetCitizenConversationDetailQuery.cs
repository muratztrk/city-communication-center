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

        // All SocialMessage IDs for this conversation
        var messageIds = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId == request.CitizenConversationId)
            .Select(m => m.SocialMessageId)
            .ToListAsync(cancellationToken);

        // Full timeline: all entries across all SocialMessages, ordered chronologically
        var timeline = await _dbContext.ConversationEntries
            .AsNoTracking()
            .Where(e => messageIds.Contains(e.SocialMessageId))
            .OrderBy(e => e.SentAt)
            .Select(e => new CitizenConversationTimelineEntryDto(
                e.EntryId,
                e.Direction.ToString(),
                e.Content,
                e.MediaId,
                e.MediaMimeType,
                e.SentAt,
                e.SocialMessageId))
            .ToListAsync(cancellationToken);

        // Last inbound message time — used by frontend for 24h window check
        var lastInboundAt = timeline
            .Where(e => e.Direction == "Inbound")
            .Select(e => (DateTimeOffset?)e.SentAt)
            .LastOrDefault();

        // Linked tickets (SocialMessages), ordered by creation
        var tickets = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId == request.CitizenConversationId)
            .OrderBy(m => m.ReceivedAtUtc)
            .Select(m => new CitizenConversationTicketDto(
                m.SocialMessageId,
                m.Status.ToString(),
                m.ReceivedAtUtc,
                m.JobId,
                m.Category))
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
