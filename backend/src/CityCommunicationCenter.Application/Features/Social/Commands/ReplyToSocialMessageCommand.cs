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

        var senderLabel = await ResolveStaffSenderLabelAsync(tenantId, request.ActorUserId, cancellationToken);

        var client = _clientFactory.GetClient(message.Channel, tenantId);
        if (client is not null)
        {
            await client.SendMessageAsync(new SendMessageRequest
            {
                RecipientId = message.CitizenHandle,
                Message = request.Content
            }, cancellationToken);
        }

        _dbContext.ConversationEntries.Add(new SocialConversationEntry
        {
            EntryId = Guid.NewGuid(),
            SocialMessageId = request.SocialMessageId,
            Direction = ConversationEntryDirection.Outbound,
            Content = request.Content,
            SentAt = DateTimeOffset.UtcNow,
            SenderLabel = senderLabel,
        });

        message.ResponseContent = request.Content;
        message.RespondedAtUtc = DateTimeOffset.UtcNow;
        if (message.Status == SocialMessageStatus.New || message.Status == SocialMessageStatus.Routed)
        {
            message.Status = SocialMessageStatus.Responded;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task<string> ResolveStaffSenderLabelAsync(
        Guid tenantId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            return await _dbContext.Tenants
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId)
                .Select(t => t.MunicipalityName)
                .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";
        }

        var actor = await _dbContext.Users
            .AsNoTracking()
            .Where(u => u.UserId == actorUserId.Value && u.TenantId == tenantId)
            .Select(u => new { u.DisplayName, DepartmentName = u.Department != null ? u.Department.Name : null })
            .FirstOrDefaultAsync(cancellationToken);

        return actor is null
            ? "Belediye"
            : ConversationEntrySenderLabelHelper.FormatStaffLabel(actor.DepartmentName, actor.DisplayName);
    }
}
