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
                (user, department) => new
                {
                    user.DisplayName,
                    user.Title,
                    DepartmentName = (string?)department.Name,
                })
            .FirstOrDefaultAsync(cancellationToken);
        if (otherUser is null) return null;

        var (userAId, userBId) = InternalConversationHelper.NormalizePair(currentUserId, request.OtherUserId);
        var conversation = await _dbContext.InternalConversations
            .FirstOrDefaultAsync(
                c => c.TenantId == tenantId && c.UserAId == userAId && c.UserBId == userBId,
                cancellationToken);

        if (conversation is null)
        {
            return new InternalConversationDetailResponse(
                null, request.OtherUserId, otherUser.DisplayName, otherUser.DepartmentName, otherUser.Title, []);
        }

        // Sınırsız transkript yüklemesi, uzun süredir devam eden konuşmalarda tekrarlanan
        // SignalR yenilemeleriyle birlikte gereksiz büyük yanıtlara yol açar — en son N mesajla
        // sınırla (codex review, card #1539). Panel şu an eski mesajlar için sayfalama sunmuyor.
        const int maxMessages = 200;
        var messageRows = await _dbContext.InternalMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && m.InternalConversationId == conversation.InternalConversationId)
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(maxMessages)
            .ToListAsync(cancellationToken);
        messageRows.Reverse();

        var messageIds = messageRows.Select(m => m.InternalMessageId).ToList();
        var attachmentRows = messageIds.Count == 0
            ? []
            : await _dbContext.Attachments
                .AsNoTracking()
                .Where(a => a.TenantId == tenantId && a.EntityType == "InternalMessage" && messageIds.Contains(a.EntityId))
                .ToListAsync(cancellationToken);
        var attachmentByMessageId = attachmentRows.ToDictionary(a => a.EntityId);

        var messages = messageRows
            .Select(m => new InternalMessageResponse(
                m.InternalMessageId,
                m.SenderUserId,
                m.Content,
                m.CreatedAtUtc,
                m.ReadAtUtc,
                attachmentByMessageId.TryGetValue(m.InternalMessageId, out var attachment)
                    ? new AttachmentResponse(
                        attachment.AttachmentId,
                        attachment.FileName,
                        attachment.ContentType,
                        attachment.FileSizeBytes,
                        attachment.RelativeUrl,
                        attachment.CreatedAtUtc)
                    : null))
            .ToList();

        return new InternalConversationDetailResponse(
            conversation.InternalConversationId,
            request.OtherUserId,
            otherUser.DisplayName,
            otherUser.DepartmentName,
            otherUser.Title,
            messages);
    }
}
