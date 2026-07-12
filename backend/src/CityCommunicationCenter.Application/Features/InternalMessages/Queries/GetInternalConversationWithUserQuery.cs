namespace CityCommunicationCenter.Application.Features.InternalMessages;

// Belirli bir kullanıcıyla olan kurum içi konuşmayı getirir; henüz konuşma yoksa
// InternalConversationId null döner (frontend boş bir sohbet ekranı açar) (card #1539).
public sealed record GetInternalConversationWithUserQuery(Guid OtherUserId, Guid? ActorUserId)
    : IQuery<InternalConversationDetailResponse?>;

public sealed class GetInternalConversationWithUserQueryHandler
    : IQueryHandler<GetInternalConversationWithUserQuery, InternalConversationDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetInternalConversationWithUserQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<InternalConversationDetailResponse?> Handle(
        GetInternalConversationWithUserQuery request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var currentUserId = request.ActorUserId ?? Guid.Empty;

        var otherUser = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.TenantId == tenantId && u.UserId == request.OtherUserId)
            .Join(
                _dbContext.Departments,
                user => user.DepartmentId,
                department => department.DepartmentId,
                (user, department) => new { user.DisplayName, DepartmentName = (string?)department.Name })
            .FirstOrDefaultAsync(cancellationToken);
        if (otherUser is null) return null;

        var (userAId, userBId) = InternalConversationHelper.NormalizePair(currentUserId, request.OtherUserId);
        var conversation = await _dbContext.InternalConversations
            .FirstOrDefaultAsync(
                c => c.TenantId == tenantId && c.UserAId == userAId && c.UserBId == userBId,
                cancellationToken);

        if (conversation is null)
        {
            return new InternalConversationDetailResponse(null, request.OtherUserId, otherUser.DisplayName, otherUser.DepartmentName, []);
        }

        var messages = await _dbContext.InternalMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.InternalConversationId == conversation.InternalConversationId)
            .OrderBy(m => m.CreatedAtUtc)
            .Select(m => new InternalMessageResponse(m.InternalMessageId, m.SenderUserId, m.Content, m.CreatedAtUtc, m.ReadAtUtc))
            .ToListAsync(cancellationToken);

        return new InternalConversationDetailResponse(
            conversation.InternalConversationId, request.OtherUserId, otherUser.DisplayName, otherUser.DepartmentName, messages);
    }
}
