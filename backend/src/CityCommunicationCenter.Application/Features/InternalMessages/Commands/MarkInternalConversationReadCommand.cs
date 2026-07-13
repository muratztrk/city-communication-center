namespace CityCommunicationCenter.Application.Features.InternalMessages;

public sealed record MarkInternalConversationReadCommand(Guid InternalConversationId, Guid? ActorUserId) : ICommand<bool>;

public sealed class MarkInternalConversationReadCommandHandler : ICommandHandler<MarkInternalConversationReadCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly INotificationPushService _notificationPushService;

    public MarkInternalConversationReadCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        INotificationPushService notificationPushService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _notificationPushService = notificationPushService;
    }

    public async ValueTask<bool> Handle(MarkInternalConversationReadCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var currentUserId = request.ActorUserId ?? Guid.Empty;

        var conversation = await _dbContext.InternalConversations.AsNoTracking()
            .FirstOrDefaultAsync(
                c => c.TenantId == tenantId
                    && c.InternalConversationId == request.InternalConversationId
                    && (c.UserAId == currentUserId || c.UserBId == currentUserId),
                cancellationToken);
        if (conversation is null) return false;

        var unreadMessages = await _dbContext.InternalMessages
            .Where(m => m.TenantId == tenantId
                && m.InternalConversationId == request.InternalConversationId
                && m.SenderUserId != currentUserId
                && m.ReadAtUtc == null)
            .ToListAsync(cancellationToken);
        if (unreadMessages.Count == 0) return true;

        var utcNow = DateTimeOffset.UtcNow;
        foreach (var message in unreadMessages)
        {
            message.ReadAtUtc = utcNow;
        }
        await _dbContext.SaveChangesAsync(cancellationToken);

        var senderUserId = conversation.UserAId == currentUserId ? conversation.UserBId : conversation.UserAId;
        try
        {
            await _notificationPushService.SendInternalMessageToUserAsync(
                tenantId,
                senderUserId,
                new InternalMessagePayload(
                    conversation.InternalConversationId,
                    currentUserId,
                    string.Empty,
                    string.Empty,
                    utcNow,
                    IsReadReceipt: true),
                cancellationToken);
        }
        catch (Exception)
        {
            // Okundu bilgisi kalıcıdır; anlık bildirim başarısızsa gönderenin periyodik yenilemesi yakalar.
        }
        return true;
    }
}
