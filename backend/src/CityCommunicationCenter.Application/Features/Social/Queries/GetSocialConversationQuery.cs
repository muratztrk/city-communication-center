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
                m.Latitude,
                m.Longitude,
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
        var messageMeta = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && messageIds.Contains(m.SocialMessageId))
            .Select(m => new { m.SocialMessageId, m.JobId, m.Latitude, m.Longitude })
            .ToListAsync(cancellationToken);
        var messageJobIds = messageMeta.ToDictionary(m => m.SocialMessageId, m => m.JobId);
        var messageCoords = messageMeta.ToDictionary(m => m.SocialMessageId, m => (m.Latitude, m.Longitude));

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
            var (fallbackLat, fallbackLon) = ConversationLocationHelper.Resolve(
                message.Content,
                (message.Latitude, message.Longitude));
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
                request.SocialMessageId,
                null,
                fallbackLat,
                fallbackLon)];
        }

        var terminalInfoByMessageId = new Dictionary<Guid, TerminalInfo>();
        foreach (var entryMessageId in entries
            .Where(e => IsTerminalNoteEligibleDelivery(e.DeliveryStatus))
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
            var hasTerminalInfo = IsTerminalNoteEligibleDelivery(e.DeliveryStatus)
                && terminalInfoByMessageId.TryGetValue(e.SocialMessageId, out terminalInfo);
            var terminalStatus = hasTerminalInfo ? terminalInfo?.Status : null;
            var terminalNote = hasTerminalInfo ? terminalInfo?.Note : null;
            var messageApprover = hasTerminalInfo ? terminalInfo?.MessageApproverDisplayName : null;

            var (latitude, longitude) = ConversationLocationHelper.Resolve(
                e.Content,
                messageCoords.GetValueOrDefault(e.SocialMessageId));
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
                e.SocialMessageId,
                messageApprover,
                latitude,
                longitude);
        }).ToList();
    }

    /// <summary>
    /// Pending ve iletilmiş (Sent/Delivered/Read) giden mesajlarda terminal not metadata'sı (card #1861).
    /// </summary>
    private static bool IsTerminalNoteEligibleDelivery(string? deliveryStatus) =>
        deliveryStatus is nameof(ConversationDeliveryStatus.Pending)
            or nameof(ConversationDeliveryStatus.Sent)
            or nameof(ConversationDeliveryStatus.Delivered)
            or nameof(ConversationDeliveryStatus.Read);

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

        var messageApproverDisplayName = await _dbContext.AuditLogs
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId
                && a.EntityType == nameof(Job)
                && a.EntityId == job.JobId.ToString()
                && a.Action == "CitizenMessageApprovalReleased")
            .OrderByDescending(a => a.EventTimeUtc)
            .Select(a => a.ActorDisplayName)
            .FirstOrDefaultAsync(cancellationToken);

        if (job.Status == JobStatus.Completed)
        {
            var completionNote = await _dbContext.Tasks
                .AsNoTracking()
                .Where(t => t.TenantId == tenantId && t.JobId == job.JobId && t.CompletedAtUtc != null)
                .OrderByDescending(t => t.CompletedAtUtc)
                .Select(t => t.Notes)
                .FirstOrDefaultAsync(cancellationToken);

            return new TerminalInfo(JobStatus.Completed.ToString(), completionNote, messageApproverDisplayName);
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

        return new TerminalInfo(JobStatus.Cancelled.ToString(), cancelNote, messageApproverDisplayName);
    }

    private sealed record TerminalInfo(string? Status, string? Note, string? MessageApproverDisplayName)
    {
        public static readonly TerminalInfo Empty = new(null, null, null);
    }
}
