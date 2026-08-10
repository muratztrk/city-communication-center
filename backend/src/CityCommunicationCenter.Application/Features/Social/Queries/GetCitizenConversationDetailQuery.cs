namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetCitizenConversationDetailQuery(Guid CitizenConversationId)
    : IQuery<CitizenConversationDetailDto?>;

public sealed class GetCitizenConversationDetailQueryHandler
    : IQueryHandler<GetCitizenConversationDetailQuery, CitizenConversationDetailDto?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenConversationDetailQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<CitizenConversationDetailDto?> Handle(
        GetCitizenConversationDetailQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

        var conversation = await _dbContext.CitizenConversations
            .AsNoTracking()
            .Where(c => c.CitizenConversationId == request.CitizenConversationId && c.TenantId == tenantId)
            .Select(c => new
            {
                c.CitizenConversationId,
                c.CitizenPhone,
                c.CitizenName,
                c.Label,
                c.Neighborhood,
                c.Street,
                c.OpenAddress,
                c.LastMessageAt,
                c.UnreadCount,
                c.IsBlocked
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (conversation is null) return null;

        var tenantName = await _dbContext.Tenants
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Select(t => t.MunicipalityName)
            .FirstOrDefaultAsync(cancellationToken) ?? "Belediye";

        var citizenPhoneLabel = ConversationEntrySenderLabelHelper.FormatCitizenPhone(
            conversation.CitizenPhone,
            conversation.CitizenPhone);

        var messageRows = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId == request.CitizenConversationId)
            .Select(m => new { m.SocialMessageId, m.Latitude, m.Longitude })
            .ToListAsync(cancellationToken);
        var messageIds = messageRows.Select(m => m.SocialMessageId).ToList();
        var messageCoords = messageRows.ToDictionary(
            m => m.SocialMessageId,
            m => (m.Latitude, m.Longitude));

        var rawTimeline = await _dbContext.ConversationEntries
            .AsNoTracking()
            .Where(e => messageIds.Contains(e.SocialMessageId))
            .OrderBy(e => e.SentAt)
            .Select(e => new
            {
                e.EntryId,
                Direction = e.Direction.ToString(),
                e.Content,
                e.MediaId,
                e.MediaMimeType,
                e.SentAt,
                e.SocialMessageId,
                e.SenderLabel,
                DeliveryStatus = e.DeliveryStatus.HasValue ? e.DeliveryStatus.Value.ToString() : null,
                e.DeliveryError,
                e.EditedAtUtc,
                e.EditedByDisplayName,
            })
            .ToListAsync(cancellationToken);

        var terminalInfoByMessageId = await ResolveTerminalInfoByMessageIdAsync(
            tenantId,
            messageIds,
            cancellationToken);

        var timeline = rawTimeline
            .Select(e =>
            {
                terminalInfoByMessageId.TryGetValue(e.SocialMessageId, out var terminalInfo);
                var (latitude, longitude) = ConversationLocationHelper.Resolve(
                    e.Content,
                    messageCoords.GetValueOrDefault(e.SocialMessageId));
                return new CitizenConversationTimelineEntryDto(
                    e.EntryId,
                    e.Direction,
                    e.Content,
                    e.MediaId,
                    e.MediaMimeType,
                    e.SentAt,
                    e.SocialMessageId,
                    e.SenderLabel
                        ?? (e.Direction == ConversationEntryDirection.Inbound.ToString()
                            ? citizenPhoneLabel
                            : tenantName),
                    e.DeliveryStatus,
                    e.DeliveryError,
                    e.EditedAtUtc,
                    e.EditedByDisplayName,
                    IsTerminalNoteEligibleDelivery(e.DeliveryStatus) ? terminalInfo?.Status : null,
                    IsTerminalNoteEligibleDelivery(e.DeliveryStatus) ? terminalInfo?.Note : null,
                    (e.DeliveryStatus is nameof(ConversationDeliveryStatus.Pending)
                        or nameof(ConversationDeliveryStatus.Failed))
                        ? terminalInfo?.MessageApproverDisplayName
                        : null,
                    latitude,
                    longitude);
            })
            .ToList();

        var lastInboundAt = timeline
            .Where(e => e.Direction == "Inbound")
            .Select(e => (DateTimeOffset?)e.SentAt)
            .LastOrDefault();

        var phoneVariants = CitizenConversationPhoneNormalizer.Variants(conversation.CitizenPhone).ToList();
        var relatedConversationIds = phoneVariants.Count == 0
            ? [request.CitizenConversationId]
            : await _dbContext.CitizenConversations
                .AsNoTracking()
                .Where(c => c.TenantId == tenantId && phoneVariants.Contains(c.CitizenPhone))
                .Select(c => c.CitizenConversationId)
                .ToListAsync(cancellationToken);
        if (relatedConversationIds.Count == 0)
        {
            relatedConversationIds = [request.CitizenConversationId];
        }

        var linkedMessageIds = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId
                && m.CitizenRequestNumber != null
                && m.CitizenConversationId != null
                && relatedConversationIds.Contains(m.CitizenConversationId.Value))
            .Select(m => m.SocialMessageId)
            .ToListAsync(cancellationToken);

        // Çağrı (Phone) VT'leri WA konuşmasına bağlanmazsa orphan kalır (#2288) — aynı telefon
        // eşleşmesiyle popup'ta tüm kanallar görünsün (card #2546).
        var unlinkedCandidates = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId
                && m.CitizenRequestNumber != null
                && (m.CitizenConversationId == null
                    || !relatedConversationIds.Contains(m.CitizenConversationId.Value)))
            .Select(m => new
            {
                m.SocialMessageId,
                m.CitizenHandle,
                JobPhone = m.Job != null ? m.Job.CitizenPhone : null,
            })
            .ToListAsync(cancellationToken);

        var ticketMessageIds = linkedMessageIds
            .Concat(unlinkedCandidates
                .Where(m => CitizenConversationPhoneNormalizer.MatchesConversationPhone(m.JobPhone, conversation.CitizenPhone)
                    || CitizenConversationPhoneNormalizer.MatchesConversationPhone(m.CitizenHandle, conversation.CitizenPhone))
                .Select(m => m.SocialMessageId))
            .Distinct()
            .ToList();

        var tickets = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => ticketMessageIds.Contains(m.SocialMessageId))
            .OrderBy(m => m.ReceivedAtUtc)
            .Select(m => new CitizenConversationTicketDto(
                m.SocialMessageId,
                m.Status.ToString(),
                m.ReceivedAtUtc,
                m.JobId,
                m.Category,
                m.CitizenRequestNumber,
                m.CitizenRequestNumberYear,
                m.Job != null ? m.Job.Priority : null,
                m.Job != null ? m.Job.Status.ToString() : null,
                m.Job != null ? m.Job.JobNumber : null,
                m.Job != null ? m.Job.JobNumberYear : null,
                m.Job != null
                    ? m.Job.Departments
                        .Where(d => d.Role == JobDepartmentRole.Target)
                        .OrderBy(d => d.RequestedAtUtc)
                        .Select(d => (Guid?)d.DepartmentId)
                        .FirstOrDefault()
                    : m.AssignedDepartmentId,
                m.Job != null
                    ? m.Job.Departments
                        .Where(d => d.Role == JobDepartmentRole.Target)
                        .OrderBy(d => d.RequestedAtUtc)
                        .Select(d => d.Department.Name)
                        .FirstOrDefault()
                    : m.AssignedDepartment != null ? m.AssignedDepartment.Name : null,
                m.Job != null
                    ? m.Job.Tasks
                        .Where(task => task.AssignedUserId != null
                            && task.CurrentStatus != Domain.Enums.TaskStatus.Completed
                            && task.CurrentStatus != Domain.Enums.TaskStatus.Cancelled
                            && task.CurrentStatus != Domain.Enums.TaskStatus.Rejected)
                        .OrderByDescending(task => task.AssignedAtUtc ?? task.CreatedAtUtc)
                        .Select(task => new
                        {
                            DisplayName = _dbContext.Users
                                .Where(user => user.TenantId == tenantId && user.UserId == task.AssignedUserId)
                                .Select(user => user.DisplayName)
                                .FirstOrDefault(),
                            DepartmentName = _dbContext.Departments
                                .Where(department => task.AssignedDepartmentId != null
                                    && department.TenantId == tenantId
                                    && department.DepartmentId == task.AssignedDepartmentId)
                                .Select(department => department.Name)
                                .FirstOrDefault()
                        })
                        .Select(assignee => assignee.DisplayName == null
                            ? null
                            : assignee.DepartmentName == null || assignee.DepartmentName == ""
                                ? assignee.DisplayName
                                : assignee.DisplayName + " (" + assignee.DepartmentName + ")")
                        .FirstOrDefault()
                    : null,
                m.Channel.ToString(),
                m.Job != null ? m.Job.Title : m.Content,
                m.Job != null ? m.Job.DueDateUtc : null))
            .ToListAsync(cancellationToken);

        var statusCounts = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId == request.CitizenConversationId && m.Job != null)
            .GroupBy(m => m.Job!.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var intakeCount = statusCounts
            .Where(s => s.Status is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested)
            .Sum(s => s.Count);
        var inProgressCount = statusCounts.Where(s => s.Status == JobStatus.Active).Sum(s => s.Count);
        var completedCount = statusCounts.Where(s => s.Status == JobStatus.Completed).Sum(s => s.Count);
        var cancelledCount = statusCounts.Where(s => s.Status is JobStatus.Cancelled or JobStatus.Rejected).Sum(s => s.Count);

        return new CitizenConversationDetailDto(
            conversation.CitizenConversationId,
            conversation.CitizenPhone,
            conversation.CitizenName,
            conversation.Label,
            conversation.Neighborhood,
            conversation.Street,
            conversation.OpenAddress,
            conversation.LastMessageAt,
            conversation.UnreadCount,
            conversation.IsBlocked,
            intakeCount,
            inProgressCount,
            completedCount,
            cancelledCount,
            lastInboundAt,
            timeline,
            tickets);
    }

    /// <summary>
    /// Pending (operatör onayı) ve iletilmiş (Sent/Delivered/Read) giden mesajlarda
    /// İptal/Tamamlanma Notu butonu için terminal metadata taşınır (card #1861).
    /// </summary>
    private static bool IsTerminalNoteEligibleDelivery(string? deliveryStatus) =>
        deliveryStatus is nameof(ConversationDeliveryStatus.Pending)
            or nameof(ConversationDeliveryStatus.Sent)
            or nameof(ConversationDeliveryStatus.Delivered)
            or nameof(ConversationDeliveryStatus.Read);

    private async Task<Dictionary<Guid, TerminalInfo>> ResolveTerminalInfoByMessageIdAsync(
        Guid tenantId,
        IReadOnlyCollection<Guid> messageIds,
        CancellationToken cancellationToken)
    {
        var linkedMessages = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => messageIds.Contains(m.SocialMessageId))
            .Select(m => new { m.SocialMessageId, m.JobId })
            .ToListAsync(cancellationToken);

        var result = new Dictionary<Guid, TerminalInfo>();
        foreach (var linkedMessage in linkedMessages)
        {
            var job = await _dbContext.Jobs
                .AsNoTracking()
                .Where(j => j.TenantId == tenantId
                    && (linkedMessage.JobId.HasValue
                        ? j.JobId == linkedMessage.JobId.Value
                        : j.SourceRefId == linkedMessage.SocialMessageId))
                .Select(j => new { j.JobId, j.Status, j.CancelReason })
                .FirstOrDefaultAsync(cancellationToken);

            if (job is null || job.Status is not (JobStatus.Completed or JobStatus.Cancelled))
            {
                continue;
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
                result[linkedMessage.SocialMessageId] = new TerminalInfo(
                    JobStatus.Completed.ToString(),
                    completionNote,
                    messageApproverDisplayName);
                continue;
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
            result[linkedMessage.SocialMessageId] = new TerminalInfo(
                JobStatus.Cancelled.ToString(),
                cancelNote,
                messageApproverDisplayName);
        }

        return result;
    }

    private sealed record TerminalInfo(string? Status, string? Note, string? MessageApproverDisplayName);
}
