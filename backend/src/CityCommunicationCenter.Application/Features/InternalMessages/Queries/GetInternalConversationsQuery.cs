namespace CityCommunicationCenter.Application.Features.InternalMessages;

// WhatsApp Konuşmaları'ndaki gibi arama/filtre/paging frontend'de yapılır — burada mevcut
// kullanıcının TÜM kurum içi konuşmaları döner (card #1539, bkz. GetCitizenConversationsQuery deseni).
public sealed record GetInternalConversationsQuery(Guid? ActorUserId) : IQuery<IReadOnlyList<InternalConversationSummaryResponse>>;

public sealed class GetInternalConversationsQueryHandler
    : IQueryHandler<GetInternalConversationsQuery, IReadOnlyList<InternalConversationSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetInternalConversationsQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<InternalConversationSummaryResponse>> Handle(
        GetInternalConversationsQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var currentUserId = request.ActorUserId ?? Guid.Empty;

        var conversations = await _dbContext.InternalConversations
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && (c.UserAId == currentUserId || c.UserBId == currentUserId))
            .ToListAsync(cancellationToken);
        if (conversations.Count == 0) return [];

        var conversationIds = conversations.Select(c => c.InternalConversationId).ToList();
        var otherUserIds = conversations
            .Select(c => c.UserAId == currentUserId ? c.UserBId : c.UserAId)
            .Distinct()
            .ToList();

        var otherUsers = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && otherUserIds.Contains(u.UserId))
            .Join(
                _dbContext.Departments,
                user => user.DepartmentId,
                department => department.DepartmentId,
                (user, department) => new { user.UserId, user.DisplayName, DepartmentName = (string?)department.Name })
            .ToDictionaryAsync(item => item.UserId, cancellationToken);

        var lastMessages = await _dbContext.InternalMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && conversationIds.Contains(m.InternalConversationId))
            .GroupBy(m => m.InternalConversationId)
            .Select(g => g.OrderByDescending(m => m.CreatedAtUtc).First())
            .ToDictionaryAsync(m => m.InternalConversationId, cancellationToken);

        var unreadCounts = await _dbContext.InternalMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId
                && conversationIds.Contains(m.InternalConversationId)
                && m.SenderUserId != currentUserId
                && m.ReadAtUtc == null)
            .GroupBy(m => m.InternalConversationId)
            .Select(g => new { ConversationId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.ConversationId, g => g.Count, cancellationToken);

        return conversations
            .Select(c =>
            {
                var otherUserId = c.UserAId == currentUserId ? c.UserBId : c.UserAId;
                var otherUser = otherUsers.GetValueOrDefault(otherUserId);
                var lastMessage = lastMessages.GetValueOrDefault(c.InternalConversationId);
                return new InternalConversationSummaryResponse(
                    c.InternalConversationId,
                    otherUserId,
                    otherUser?.DisplayName ?? "—",
                    otherUser?.DepartmentName,
                    lastMessage?.Content,
                    lastMessage?.SenderUserId,
                    c.LastMessageAtUtc,
                    unreadCounts.GetValueOrDefault(c.InternalConversationId));
            })
            .OrderByDescending(item => item.LastMessageAtUtc)
            .ToList();
    }
}
