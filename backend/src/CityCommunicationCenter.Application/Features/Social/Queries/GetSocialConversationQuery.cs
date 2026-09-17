using CityCommunicationCenter.Application.Features.CitizenMessageApprovals;
using CityCommunicationCenter.Domain;

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

        var timedAutoReplyContents = await _dbContext.WhatsAppTemplates
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.IsActive && t.AutoReply && t.TimedReplyEnabled && t.ReplyDelaySecs > 0)
            .Select(t => t.Content)
            .ToHashSetAsync(cancellationToken);

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
            .Select(e => new
            {
                e.EntryId,
                e.SocialMessageId,
                e.Direction,
                DirectionLabel = e.Direction.ToString(),
                e.Content,
                e.MediaId,
                e.MediaMimeType,
                e.SentAt,
                e.SenderLabel,
                e.DeliveryStatus,
                DeliveryStatusLabel = e.DeliveryStatus.HasValue ? e.DeliveryStatus.Value.ToString() : null,
                e.DeliveryError,
                e.DeliveryStatusUpdatedAtUtc,
                e.EditedAtUtc,
                e.EditedByDisplayName,
                e.RelayedByDisplayName,
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
                null,
                null,
                null,
                request.SocialMessageId,
                null,
                fallbackLat,
                fallbackLon,
                false)];
        }

        var terminalInfoByMessageId = new Dictionary<Guid, TerminalInfo>();
        foreach (var entryMessageId in entries
            .Where(e => IsTerminalNoteEligibleDelivery(e.DeliveryStatusLabel))
            .Select(e => e.SocialMessageId)
            .Distinct())
        {
            terminalInfoByMessageId[entryMessageId] = await ResolveRelatedTerminalInfoAsync(
                tenantId,
                entryMessageId,
                messageJobIds.GetValueOrDefault(entryMessageId),
                cancellationToken);
        }

        var releasedAtByMessageId = await ConversationEntryOperatorVisibility.ResolveReleasedAtByMessageIdAsync(
            _dbContext,
            tenantId,
            messageIds,
            cancellationToken);
        var departmentNamesByMessageId = await ConversationAutomaticSenderLabelResolver
            .ResolveTargetDepartmentNamesByMessageIdAsync(
                _dbContext,
                tenantId,
                messageIds,
                cancellationToken);

        return entries
            .Where(e => !ConversationEntryOperatorVisibility.IsTerminalPendingAwaitingManagerRelease(
                e.Direction,
                e.DeliveryStatus,
                e.SenderLabel,
                e.Content,
                releasedAtByMessageId.GetValueOrDefault(e.SocialMessageId)))
            .OrderBy(e => ConversationEntryTimelineTime.ResolveSortKey(
                e.Direction,
                e.SentAt,
                e.DeliveryStatus,
                e.DeliveryStatusUpdatedAtUtc))
            .Select(e =>
        {
            TerminalInfo? terminalInfo = null;
            var hasTerminalInfo = IsTerminalNoteEligibleDelivery(e.DeliveryStatusLabel)
                && terminalInfoByMessageId.TryGetValue(e.SocialMessageId, out terminalInfo);
            var terminalStatus = hasTerminalInfo ? terminalInfo?.Status : null;
            var terminalNote = hasTerminalInfo ? terminalInfo?.Note : null;
            var messageApprover = hasTerminalInfo
                && e.DeliveryStatusLabel is nameof(ConversationDeliveryStatus.Pending)
                    or nameof(ConversationDeliveryStatus.Failed)
                ? terminalInfo?.MessageApproverDisplayName
                : null;

            var (latitude, longitude) = ConversationLocationHelper.Resolve(
                e.Content,
                messageCoords.GetValueOrDefault(e.SocialMessageId));
            return new SocialConversationEntryDto(
                e.EntryId,
                e.DirectionLabel,
                e.Content,
                e.MediaId,
                e.MediaMimeType,
                e.SentAt,
                ConversationEntrySenderLabelHelper.EnrichAutomaticAttachmentSenderLabel(
                    e.Direction,
                    e.SenderLabel
                        ?? (e.Direction == ConversationEntryDirection.Inbound
                            ? citizenPhoneLabel
                            : tenantName),
                    e.Content,
                    tenantName,
                    departmentNamesByMessageId.GetValueOrDefault(e.SocialMessageId)),
                e.DeliveryStatusLabel,
                e.DeliveryError,
                e.DeliveryStatusUpdatedAtUtc,
                e.EditedAtUtc,
                e.EditedByDisplayName,
                e.RelayedByDisplayName,
                terminalStatus,
                terminalNote,
                e.SocialMessageId,
                messageApprover,
                latitude,
                longitude,
                WhatsAppTemplateAutoReply.IsAutomaticTimedReplyEntry(
                    e.DirectionLabel,
                    e.DeliveryStatusLabel,
                    e.Content,
                    timedAutoReplyContents));
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

        string? messageApproverDisplayName;
        if (job.Status == JobStatus.Cancelled)
        {
            messageApproverDisplayName = await CitizenMessageApprovalNoteResolver.ResolveCancelledJobInitiatorDisplayNameAsync(
                _dbContext,
                tenantId,
                job.JobId,
                cancellationToken);
        }
        else
        {
            messageApproverDisplayName = await CitizenMessageApprovalNoteResolver.ResolveMessageApproverDisplayNameAsync(
                _dbContext,
                tenantId,
                job.JobId,
                cancellationToken);
        }

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
