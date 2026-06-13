namespace CityCommunicationCenter.Application.Features.Social;

public sealed record ReplyToSocialMessageCommand(
    Guid SocialMessageId,
    Guid? ActorUserId,
    string Content) : ICommand<bool>;

public sealed class ReplyToSocialMessageCommandHandler : ICommandHandler<ReplyToSocialMessageCommand, bool>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ISocialMediaClientFactory _clientFactory;

    public ReplyToSocialMessageCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ISocialMediaClientFactory clientFactory)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _clientFactory = clientFactory;
    }

    public async ValueTask<bool> Handle(ReplyToSocialMessageCommand request, CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var message = await _dbContext.SocialMessages
            .FirstOrDefaultAsync(m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId, cancellationToken);

        if (message is null) return false;

        // Send via the appropriate channel client
        var client = _clientFactory.GetClient(message.Channel, tenantId);
        if (client is not null)
        {
            await client.SendMessageAsync(new SendMessageRequest
            {
                RecipientId = message.CitizenHandle,
                Message = request.Content
            }, cancellationToken);
        }

        // Store outbound entry regardless of send result
        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = request.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = request.Content,
            SentAt = DateTimeOffset.UtcNow
        });

        // Update parent message response fields
        message.ResponseContent = request.Content;
        message.RespondedAtUtc = DateTimeOffset.UtcNow;
        if (message.Status == SocialMessageStatus.New || message.Status == SocialMessageStatus.Routed)
        {
            message.Status = SocialMessageStatus.Responded;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
