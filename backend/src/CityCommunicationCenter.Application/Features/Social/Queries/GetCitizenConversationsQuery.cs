namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetCitizenConversationsQuery : IQuery<IReadOnlyList<CitizenConversationSummaryDto>>;

public sealed class GetCitizenConversationsQueryHandler
    : IQueryHandler<GetCitizenConversationsQuery, IReadOnlyList<CitizenConversationSummaryDto>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenConversationsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<CitizenConversationSummaryDto>> Handle(
        GetCitizenConversationsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var conversations = await _dbContext.CitizenConversations
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderByDescending(c => c.LastMessageAt)
            .Select(c => new
            {
                c.CitizenConversationId,
                c.CitizenPhone,
                c.CitizenName,
                c.LastMessageAt,
                c.UnreadCount,
                c.IsBlocked,
                OpenTicketCount = _dbContext.SocialMessages
                    .Count(m => m.CitizenConversationId == c.CitizenConversationId
                                && m.Status != SocialMessageStatus.Closed),
                LastMessagePreview = _dbContext.ConversationEntries
                    .Where(e => _dbContext.SocialMessages
                        .Any(m => m.CitizenConversationId == c.CitizenConversationId
                                  && m.SocialMessageId == e.SocialMessageId))
                    .OrderByDescending(e => e.SentAt)
                    .Select(e => e.Content)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        return conversations
            .Select(c => new CitizenConversationSummaryDto(
                c.CitizenConversationId,
                c.CitizenPhone,
                c.CitizenName,
                c.LastMessageAt,
                c.UnreadCount,
                c.IsBlocked,
                c.LastMessagePreview,
                c.OpenTicketCount))
            .ToList();
    }
}
