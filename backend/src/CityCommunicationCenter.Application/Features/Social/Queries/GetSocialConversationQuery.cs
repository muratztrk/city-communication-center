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
                m.JobId,
                m.CitizenConversationId,
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

        var messageIds = message.CitizenConversationId.HasValue
            ? await _dbContext.SocialMessages
                .AsNoTracking()
                .Where(m => m.TenantId == tenantId && m.CitizenConversationId == message.CitizenConversationId)
                .OrderBy(m => m.ReceivedAtUtc)
                .Select(m => m.SocialMessageId)
                .ToListAsync(cancellationToken)
            : [request.SocialMessageId];
        var messageJobIds = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && messageIds.Contains(m.SocialMessageId))
            .Select(m => new { m.SocialMessageId, m.JobId })
            .ToDictionaryAsync(m => m.SocialMessageId, m => m.JobId, cancellationToken);

        var entries = await _dbContext.ConversationEntries
            .AsNoTracking()
            .Where(e => messageIds.Contains(e.SocialMessageId))
            .OrderBy(e => e.SentAt)
            .Select(e => new
            {
                e.EntryId,
                e.SocialMessageId,
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
                null,
                null,
                null,
                request.SocialMessageId)];
        }

        var terminalInfoByMessageId = new Dictionary<Guid, TerminalInfo>();
        foreach (var entryMessageId in entries
            .Where(e => e.DeliveryStatus == ConversationDeliveryStatus.Pending.ToString())
            .Select(e => e.SocialMessageId)
            .Distinct())
        {
            terminalInfoByMessageId[entryMessageId] = await ResolveRelatedTerminalInfoAsync(
                tenantId,
                entryMessageId,
                messageJobIds.GetValueOrDefault(entryMessageId),
                cancellationToken);
        }

        return entries.Select(e =>
        {
            TerminalInfo? terminalInfo = null;
            var hasTerminalInfo = e.DeliveryStatus == ConversationDeliveryStatus.Pending.ToString()
                && terminalInfoByMessageId.TryGetValue(e.SocialMessageId, out terminalInfo);
            var terminalStatus = hasTerminalInfo ? terminalInfo?.Status : null;
            var terminalNote = hasTerminalInfo ? terminalInfo?.Note : null;

            return new SocialConversationEntryDto(
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
                e.EditedAtUtc,
                terminalStatus,
                terminalNote,
                e.SocialMessageId);
        }).ToList();
    }

    private async Task<TerminalInfo> ResolveRelatedTerminalInfoAsync(
        Guid tenantId,
        Guid socialMessageId,
        Guid? messageJobId,
        CancellationToken cancellationToken)
    {
        var job = await _dbContext.Jobs
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId
                && (messageJobId.HasValue
                    ? j.JobId == messageJobId.Value
                    : j.SourceRefId == socialMessageId))
            .Select(j => new { j.JobId, j.Status, j.CancelReason })
            .FirstOrDefaultAsync(cancellationToken);

        if (job is null || job.Status is not (JobStatus.Completed or JobStatus.Cancelled))
        {
            return TerminalInfo.Empty;
        }

        if (job.Status == JobStatus.Completed)
        {
            var completionNote = await _dbContext.Tasks
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId && t.JobId == job.JobId && t.CompletedAtUtc != null)
                .OrderByDescending(t => t.CompletedAtUtc)
                .Select(t => t.Notes)
                .FirstOrDefaultAsync(cancellationToken);

            return new TerminalInfo(JobStatus.Completed.ToString(), completionNote);
        }

        var cancelNote = !string.IsNullOrWhiteSpace(job.CancelReason)
            ? job.CancelReason
            : await _dbContext.Tasks
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId
                    && t.JobId == job.JobId
                    && t.CurrentStatus == CityCommunicationCenter.Domain.Enums.TaskStatus.Cancelled)
                .OrderByDescending(t => t.UpdatedAtUtc)
                .Select(t => t.RevisionReason)
                .FirstOrDefaultAsync(cancellationToken);

        return new TerminalInfo(JobStatus.Cancelled.ToString(), cancelNote);
    }

    private sealed record TerminalInfo(string? Status, string? Note)
    {
        public static readonly TerminalInfo Empty = new(null, null);
    }
}
