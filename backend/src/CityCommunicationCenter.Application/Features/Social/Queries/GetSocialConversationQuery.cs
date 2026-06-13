namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetSocialConversationQuery(Guid SocialMessageId) : IQuery<IReadOnlyList<SocialConversationEntryDto>>;

public sealed class GetSocialConversationQueryHandler
    : IQueryHandler<GetSocialConversationQuery, IReadOnlyList<SocialConversationEntryDto>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetSocialConversationQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<SocialConversationEntryDto>> Handle(
        GetSocialConversationQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var messageExists = await _dbContext.SocialMessages
            .AnyAsync(m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId, cancellationToken);

        if (!messageExists) return [];

        var entries = await _dbContext.ConversationEntries
            .Where(e => e.SocialMessageId == request.SocialMessageId)
            .OrderBy(e => e.SentAt)
            .Select(e => new SocialConversationEntryDto(
                e.EntryId,
                e.Direction.ToString(),
                e.Content,
                e.MediaId,
                e.MediaMimeType,
                e.SentAt))
            .ToListAsync(cancellationToken);

        // Backward compat: if no entries exist, synthesise one from the parent message content.
        if (entries.Count == 0)
        {
            var message = await _dbContext.SocialMessages
                .Where(m => m.SocialMessageId == request.SocialMessageId)
                .Select(m => new { m.Content, m.ReceivedAtUtc })
                .FirstOrDefaultAsync(cancellationToken);

            if (message is not null && !string.IsNullOrWhiteSpace(message.Content))
            {
                return [new SocialConversationEntryDto(
                    Guid.Empty,
                    "Inbound",
                    message.Content,
                    null,
                    null,
                    message.ReceivedAtUtc)];
            }
        }

        return entries;
    }
}
