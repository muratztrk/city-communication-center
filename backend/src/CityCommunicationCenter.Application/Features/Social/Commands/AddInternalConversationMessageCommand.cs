namespace CityCommunicationCenter.Application.Features.Social;

public sealed record AddInternalConversationMessageCommand(
    Guid SocialMessageId,
    Guid DepartmentId,
    Guid? ActorUserId,
    string Content) : ICommand<bool>;

public sealed class AddInternalConversationMessageCommandHandler
    : ICommandHandler<AddInternalConversationMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public AddInternalConversationMessageCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<bool> Handle(AddInternalConversationMessageCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var content = request.Content.Trim();
        if (string.IsNullOrWhiteSpace(content)) return false;

        var message = await _dbContext.SocialMessages
            .FirstOrDefaultAsync(m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId, cancellationToken);
        if (message is null) return false;

        var departmentName = await _dbContext.Departments
            .AsNoTracking()
            .Where(d => d.DepartmentId == request.DepartmentId && d.TenantId == tenantId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync(cancellationToken);
        if (departmentName is null) return false;

        var actorName = request.ActorUserId.HasValue
            ? await _dbContext.Users
                .AsNoTracking()
                .Where(u => u.UserId == request.ActorUserId.Value && u.TenantId == tenantId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var utcNow = DateTimeOffset.UtcNow;
        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = request.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = content,
            SentAt = utcNow,
            SenderLabel = $"Kurum İçi Mesaj · {departmentName}{(string.IsNullOrWhiteSpace(actorName) ? string.Empty : $" · {actorName}")}",
            DeliveryStatus = null,
            DeliveryStatusUpdatedAtUtc = null,
        });

        if (message.CitizenConversationId is Guid conversationId)
        {
            var conversation = await _dbContext.CitizenConversations
                .FirstOrDefaultAsync(c => c.CitizenConversationId == conversationId && c.TenantId == tenantId, cancellationToken);
            if (conversation is not null && utcNow > conversation.LastMessageAt)
            {
                conversation.LastMessageAt = utcNow;
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
