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

        var message = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.SocialMessageId == request.SocialMessageId && m.TenantId == tenantId)
            .Select(m => new
            {
                m.Content,
                m.ReceivedAtUtc,
                m.CitizenHandle,
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (message is null) return [];

        var citizenPhoneLabel = ConversationEntrySenderLabelHelper.FormatCitizenPhone(
            message.CitizenHandle,
            null);

        var tenantName = await _dbContext.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";

        var entries = await _dbContext.ConversationEntries
            .AsNoTracking()
            .Where(e => e.SocialMessageId == request.SocialMessageId)
            .OrderBy(e => e.SentAt)
            .Select(e => new
            {
                e.EntryId,
                Direction = e.Direction.ToString(),
                e.Content,
                e.MediaId,
                e.MediaMimeType,
                e.SentAt,
                e.SenderLabel,
                DeliveryStatus = e.DeliveryStatus.HasValue ? e.DeliveryStatus.Value.ToString() : null,
                e.DeliveryError,
                e.EditedAtUtc,
            })
            .ToListAsync(cancellationToken);

        if (entries.Count == 0 && !string.IsNullOrWhiteSpace(message.Content))
        {
            return [new SocialConversationEntryDto(
                Guid.Empty,
                "Inbound",
                message.Content,
                null,
                null,
                message.ReceivedAtUtc,
                citizenPhoneLabel,
                null,
                null,
                null)];
        }

        return entries.Select(e => new SocialConversationEntryDto(
            e.EntryId,
            e.Direction,
            e.Content,
            e.MediaId,
            e.MediaMimeType,
            e.SentAt,
            e.SenderLabel
                ?? (e.Direction == ConversationEntryDirection.Inbound.ToString()
                    ? citizenPhoneLabel
                    : tenantName),
            e.DeliveryStatus,
            e.DeliveryError,
            e.EditedAtUtc)).ToList();
    }
}
