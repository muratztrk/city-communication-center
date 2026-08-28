using CityCommunicationCenter.Application.Features.Reports;
using CityCommunicationCenter.Application.Features.Users;

namespace CityCommunicationCenter.Application.Features.Social;

/// <param name="WhatsAppOnly">
/// true ise yalnız WhatsApp kanalında iletişimi olan konuşmalar döner (card #1864);
/// çağrı/telefon VT ile oluşan numaralar WhatsApp listesinden çıkar.
/// </param>
public sealed record GetCitizenConversationsQuery(bool WhatsAppOnly = false)
    : IQuery<IReadOnlyList<CitizenConversationSummaryDto>>;

public sealed class GetCitizenConversationsQueryHandler
    : IQueryHandler<GetCitizenConversationsQuery, IReadOnlyList<CitizenConversationSummaryDto>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetCitizenConversationsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<CitizenConversationSummaryDto>> Handle(
        GetCitizenConversationsQuery request,
        CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var currentUserId = context.UserId;
        var canSeeAllConversations = Enum.TryParse<RoleCode>(context.RoleCode, true, out var roleCode)
            && roleCode is RoleCode.Operator or RoleCode.SystemAdmin;

        // Operatör/çağrı ile oluşmuş VT'ler için eksik CitizenConversation satırlarını tamamla (card #1858).
        await BackfillMissingCitizenConversationsAsync(tenantId, cancellationToken);

        var conversations = await _dbContext.CitizenConversations
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId)
            .OrderByDescending(c => c.LastMessageAt)
            .Select(c => new
            {
                c.CitizenConversationId,
                c.CitizenPhone,
                c.CitizenName,
                c.Label,
                c.Neighborhood,
                c.Street,
                c.StreetNo,
                c.OpenAddress,
                c.LastMessageAt,
                c.UnreadCount,
                c.IsBlocked,
                c.WaitingReplyClearedAtUtc,
                OpenTicketCount = _dbContext.SocialMessages
                    .Count(m => m.CitizenConversationId == c.CitizenConversationId
                                && m.Status != SocialMessageStatus.Closed),
                LastMessagePreview = _dbContext.ConversationEntries
                    .Where(e => _dbContext.SocialMessages
                        .Any(m => m.CitizenConversationId == c.CitizenConversationId
                                  && m.SocialMessageId == e.SocialMessageId))
                    .OrderByDescending(e => e.SentAt)
                    .Select(e => e.Content)
                    .FirstOrDefault(),
                LastMessageDirection = _dbContext.ConversationEntries
                    .Where(e => _dbContext.SocialMessages
                        .Any(m => m.CitizenConversationId == c.CitizenConversationId
                                  && m.SocialMessageId == e.SocialMessageId))
                    .OrderByDescending(e => e.SentAt)
                    .Select(e => (ConversationEntryDirection?)e.Direction)
                    .FirstOrDefault(),
                // Son mesaj kurum içi ileti ise, bildirim çanında kimin gönderdiğini göstermek için (card #1497).
                LastMessageSenderLabel = _dbContext.ConversationEntries
                    .Where(e => _dbContext.SocialMessages
                        .Any(m => m.CitizenConversationId == c.CitizenConversationId
                                  && m.SocialMessageId == e.SocialMessageId))
                    .OrderByDescending(e => e.SentAt)
                    .Select(e => e.SenderLabel)
                    .FirstOrDefault(),
                LastMessageDeliveryStatus = _dbContext.ConversationEntries
                    .Where(e => _dbContext.SocialMessages
                        .Any(m => m.CitizenConversationId == c.CitizenConversationId
                                  && m.SocialMessageId == e.SocialMessageId))
                    .OrderByDescending(e => e.SentAt)
                    .Select(e => e.DeliveryStatus)
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        if (conversations.Count == 0)
        {
            return [];
        }

        var conversationIds = conversations.Select(c => c.CitizenConversationId).ToList();

        // "BEKLEMEDE" personel yanıtı — FAB'da görünsün (card #1472).
        // İşleme Alındı/Yapılmakta/Tamamlandı/İptal otomatik durum şablonları (belediye
        // gönderen veya "talebinizin durumu") bekleyen kalsa bile FAB sayacı/satırı üretmez.
        var pendingOutboundRows = await _dbContext.ConversationEntries
            .AsNoTracking()
            .Where(e => e.Direction == ConversationEntryDirection.Outbound && e.DeliveryStatus == ConversationDeliveryStatus.Pending)
            .Join(
                _dbContext.SocialMessages.Where(m => m.CitizenConversationId != null && conversationIds.Contains(m.CitizenConversationId.Value)),
                e => e.SocialMessageId,
                m => m.SocialMessageId,
                (e, m) => new
                {
                    ConversationId = m.CitizenConversationId!.Value,
                    e.SenderLabel,
                    e.Content,
                })
            .ToListAsync(cancellationToken);
        var pendingOutboundConversationIds = pendingOutboundRows
            .Where(row => !ConversationEntrySenderLabelHelper.IsAutomaticOutbound(
                ConversationEntryDirection.Outbound,
                ConversationDeliveryStatus.Pending,
                row.SenderLabel,
                row.Content))
            .Select(row => row.ConversationId)
            .ToHashSet();

        var socialMessages = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId != null && conversationIds.Contains(m.CitizenConversationId.Value))
            .Select(m => new
            {
                ConversationId = m.CitizenConversationId!.Value,
                m.SocialMessageId,
                m.Status,
                m.CitizenRequestNumber,
                m.CitizenRequestNumberYear,
                m.ReceivedAtUtc,
                m.JobId,
                JobStatus = m.Job != null ? (JobStatus?)m.Job.Status : null,
                Priority = m.Job != null ? m.Job.Priority : null,
                Channel = m.Channel,
            })
            .ToListAsync(cancellationToken);

        var latestTicketByConversation = socialMessages
            .GroupBy(m => m.ConversationId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderByDescending(m => m.Status != SocialMessageStatus.Closed)
                    .ThenByDescending(m => m.ReceivedAtUtc)
                    .First());

        var jobIds = latestTicketByConversation.Values
            .Where(t => t.JobId.HasValue)
            .Select(t => t.JobId!.Value)
            .Distinct()
            .ToList();

        var allConversationJobIds = socialMessages
            .Where(m => m.JobId.HasValue)
            .Select(m => m.JobId!.Value)
            .Distinct()
            .ToList();

        var jobIdsForClassification = allConversationJobIds
            .Concat(jobIds)
            .Distinct()
            .ToList();

        var jobSliceById = jobIdsForClassification.Count == 0
            ? new Dictionary<Guid, CitizenVtDashboardClassification.JobSlice>()
            : await _dbContext.Jobs.AsNoTracking()
                .Where(job => jobIdsForClassification.Contains(job.JobId))
                .Select(job => new
                {
                    job.JobId,
                    job.Status,
                    job.DueDateUtc,
                    OpenTaskCount = _dbContext.Tasks.Count(task => task.JobId == job.JobId
                        && task.CurrentStatus != Domain.Enums.TaskStatus.Completed
                        && task.CurrentStatus != Domain.Enums.TaskStatus.Cancelled
                        && task.CurrentStatus != Domain.Enums.TaskStatus.Rejected),
                })
                .ToDictionaryAsync(
                    item => item.JobId,
                    item => new CitizenVtDashboardClassification.JobSlice(item.Status, item.DueDateUtc, item.OpenTaskCount),
                    cancellationToken);

        var classificationNow = DateTimeOffset.UtcNow;

        var assigneeByJobId = new Dictionary<Guid, string>();
        var assigneeUserIdByJobId = new Dictionary<Guid, Guid>();
        if (jobIds.Count > 0)
        {
            var taskAssignees = await _dbContext.Tasks
                .AsNoTracking()
                .Where(t => jobIds.Contains(t.JobId) && t.AssignedUserId != null)
                .Select(t => new { t.JobId, t.AssignedUserId, t.AssignedAtUtc })
                .ToListAsync(cancellationToken);

            var userIds = taskAssignees
                .Select(t => t.AssignedUserId!.Value)
                .Distinct()
                .ToList();

            var displayNamesByUserId = userIds.Count == 0
                ? new Dictionary<Guid, string>()
                : await _dbContext.Users
                    .AsNoTracking()
                    .Where(u => userIds.Contains(u.UserId))
                    .Select(u => new { u.UserId, u.DisplayName })
                    .ToDictionaryAsync(u => u.UserId, u => u.DisplayName, cancellationToken);

            assigneeByJobId = taskAssignees
                .GroupBy(t => t.JobId)
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var latest = g.OrderByDescending(t => t.AssignedAtUtc).First();
                        return displayNamesByUserId.TryGetValue(latest.AssignedUserId!.Value, out var name)
                            ? name
                            : string.Empty;
                    });

            assigneeUserIdByJobId = taskAssignees
                .GroupBy(t => t.JobId)
                .ToDictionary(
                    g => g.Key,
                    g => g.OrderByDescending(t => t.AssignedAtUtc).First().AssignedUserId!.Value);
        }

        var relevantJobIds = new HashSet<Guid>();
        if (jobIds.Count > 0 && !canSeeAllConversations && currentUserId is Guid userId)
        {
            var user = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == userId && u.TenantId == tenantId, cancellationToken);

            if (user is not null)
            {
                foreach (var pair in assigneeUserIdByJobId)
                {
                    if (pair.Value == userId)
                    {
                        relevantJobIds.Add(pair.Key);
                    }
                }

                // Aktif birim seçimi yerine kullanıcının erişebildiği tüm birimler (card #1295 reopen).
                var accessibleDepartmentIds = await UserDepartmentAccess.GetAccessibleDepartmentIdsAsync(
                    _dbContext,
                    tenantId,
                    user,
                    cancellationToken,
                    includeManagedDepartments: true);

                if (accessibleDepartmentIds.Length > 0)
                {
                    var departmentJobIds = await _dbContext.JobDepartments
                        .AsNoTracking()
                        .Where(jd => jobIds.Contains(jd.JobId)
                            && accessibleDepartmentIds.Contains(jd.DepartmentId)
                            && jd.Role == JobDepartmentRole.Target
                            && jd.ApprovalStatus == JobApprovalStatus.Approved)
                        .Select(jd => jd.JobId)
                        .ToListAsync(cancellationToken);

                    foreach (var jobId in departmentJobIds)
                    {
                        relevantJobIds.Add(jobId);
                    }
                }
            }
        }

        var results = conversations
            .Select(c =>
            {
                latestTicketByConversation.TryGetValue(c.CitizenConversationId, out var ticket);
                string? assigneeDisplayName = null;
                if (ticket?.JobId is Guid jobId && assigneeByJobId.TryGetValue(jobId, out var name) && !string.IsNullOrWhiteSpace(name))
                {
                    assigneeDisplayName = name;
                }

                // Son mesaj vatandaşa değil, personel tarafından yazıldıysa (kurum içi ileti:
                // "Kurum İçi Mesaj · {birim} · {ad}", veya henüz gönderilmemiş/Beklemede yanıt:
                // "{birim} · {ad}"), bildirim çanında birim + gönderen adı gösterilsin diye
                // etiketten ayrıştırılır (card #1497/#1500).
                string? lastStaffSenderDepartment = null;
                string? lastStaffSenderDisplayName = null;
                if (c.LastMessageSenderLabel is not null)
                {
                    var isInternalNote = c.LastMessageSenderLabel.StartsWith("Kurum İçi Mesaj");
                    var labelParts = c.LastMessageSenderLabel.Split(" · ");
                    if (isInternalNote && labelParts.Length >= 3)
                    {
                        lastStaffSenderDepartment = labelParts[1];
                        lastStaffSenderDisplayName = labelParts[^1];
                    }
                    else if (!isInternalNote && labelParts.Length == 2)
                    {
                        lastStaffSenderDepartment = labelParts[0];
                        lastStaffSenderDisplayName = labelParts[1];
                    }
                }

                var conversationMessages = socialMessages
                    .Where(m => m.ConversationId == c.CitizenConversationId)
                    .ToList();
                var hasActiveJob = conversationMessages.Any(m => m.JobStatus is not null and not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected));
                var isRelevantToCurrentUser = canSeeAllConversations
                    ? hasActiveJob || c.OpenTicketCount > 0
                    : conversationMessages.Any(m => m.JobId is Guid messageJobId && relevantJobIds.Contains(messageJobId)
                        && m.JobStatus is not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected));
                var hasWhatsAppChannel = conversationMessages.Any(m => m.Channel == SocialChannel.WhatsApp);
                var lastMessageIsAutomaticOutbound = ConversationEntrySenderLabelHelper.IsAutomaticOutbound(
                    c.LastMessageDirection,
                    c.LastMessageDeliveryStatus,
                    c.LastMessageSenderLabel,
                    c.LastMessagePreview);

                var intakeCount = 0;
                var inProgressCount = 0;
                var completedCount = 0;
                var cancelledCount = 0;
                var countedJobIds = new HashSet<Guid>();
                foreach (var message in conversationMessages)
                {
                    if (message.Channel != SocialChannel.WhatsApp
                        || message.JobId is not Guid classifiedJobId
                        || !countedJobIds.Add(classifiedJobId)
                        || !jobSliceById.TryGetValue(classifiedJobId, out var jobSlice))
                    {
                        continue;
                    }

                    switch (CitizenVtDashboardClassification.Classify(jobSlice, classificationNow))
                    {
                        case CitizenVtDashboardClassification.DisplayStatus.ProcessingReceived:
                            intakeCount++;
                            break;
                        case CitizenVtDashboardClassification.DisplayStatus.InProgress
                            or CitizenVtDashboardClassification.DisplayStatus.Overdue:
                            inProgressCount++;
                            break;
                        case CitizenVtDashboardClassification.DisplayStatus.Completed:
                            completedCount++;
                            break;
                        case CitizenVtDashboardClassification.DisplayStatus.Cancelled:
                            cancelledCount++;
                            break;
                    }
                }

                var dto = new CitizenConversationSummaryDto(
                    c.CitizenConversationId,
                    c.CitizenPhone,
                    c.CitizenName,
                    c.LastMessageAt,
                    c.UnreadCount,
                    c.IsBlocked,
                    c.LastMessagePreview,
                    c.OpenTicketCount,
                    c.LastMessageDirection?.ToString(),
                    ticket?.CitizenRequestNumber,
                    ticket?.CitizenRequestNumberYear,
                    ticket?.Priority,
                    ticket?.Status.ToString(),
                    assigneeDisplayName,
                    isRelevantToCurrentUser,
                    intakeCount,
                    inProgressCount,
                    completedCount,
                    cancelledCount,
                    c.Label,
                    c.Neighborhood,
                    c.Street,
                    c.StreetNo,
                    c.OpenAddress,
                    pendingOutboundConversationIds.Contains(c.CitizenConversationId),
                    ticket?.SocialMessageId,
                    lastStaffSenderDepartment,
                    lastStaffSenderDisplayName,
                    ticket?.Channel.ToString(),
                    c.WaitingReplyClearedAtUtc,
                    lastMessageIsAutomaticOutbound);

                return (HasWhatsAppChannel: hasWhatsAppChannel, Dto: dto);
            })
            .ToList();

        // WhatsApp Konuşmaları / FAB: yalnız gerçek WA iletişimi olan numaralar (card #1864).
        IEnumerable<(bool HasWhatsAppChannel, CitizenConversationSummaryDto Dto)> filtered = results;
        if (request.WhatsAppOnly)
        {
            filtered = results.Where(item => item.HasWhatsAppChannel);
        }

        return filtered.Select(item => item.Dto).ToList();
    }

    /// <summary>
    /// Phone/operatör VT'lerinde CitizenConversation oluşmamış kayıtları bağlar (card #1858 / VT-2026-67).
    /// </summary>
    private async Task BackfillMissingCitizenConversationsAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var orphans = await _dbContext.SocialMessages
            .Where(message => message.TenantId == tenantId
                && message.CitizenConversationId == null
                && message.CitizenRequestNumber != null)
            .Select(message => new
            {
                message.SocialMessageId,
                message.Channel,
                message.CitizenHandle,
                JobCitizenPhone = message.JobId.HasValue
                    ? _dbContext.Jobs
                        .Where(job => job.JobId == message.JobId.Value)
                        .Select(job => job.CitizenPhone)
                        .FirstOrDefault()
                    : null,
                JobCitizenName = message.JobId.HasValue
                    ? _dbContext.Jobs
                        .Where(job => job.JobId == message.JobId.Value)
                        .Select(job => job.CitizenName)
                        .FirstOrDefault()
                    : null,
                JobNeighborhood = message.JobId.HasValue
                    ? _dbContext.Jobs
                        .Where(job => job.JobId == message.JobId.Value)
                        .Select(job => job.Neighborhood)
                        .FirstOrDefault()
                    : null,
                JobStreet = message.JobId.HasValue
                    ? _dbContext.Jobs
                        .Where(job => job.JobId == message.JobId.Value)
                        .Select(job => job.Street)
                        .FirstOrDefault()
                    : null,
                JobOpenAddress = message.JobId.HasValue
                    ? _dbContext.Jobs
                        .Where(job => job.JobId == message.JobId.Value)
                        .Select(job => job.OpenAddress)
                        .FirstOrDefault()
                    : null,
            })
            .ToListAsync(cancellationToken);

        if (orphans.Count == 0)
        {
            return;
        }

        var existingPhones = await _dbContext.CitizenConversations
            .Where(conversation => conversation.TenantId == tenantId)
            .Select(conversation => new { conversation.CitizenConversationId, conversation.CitizenPhone })
            .ToListAsync(cancellationToken);
        var byPhone = existingPhones
            .GroupBy(item => item.CitizenPhone, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().CitizenConversationId, StringComparer.Ordinal);

        var changed = false;
        foreach (var orphan in orphans)
        {
            var normalized = CitizenConversationPhoneNormalizer.Normalize(orphan.JobCitizenPhone)
                ?? CitizenConversationPhoneNormalizer.Normalize(orphan.CitizenHandle);
            if (normalized is null)
            {
                continue;
            }

            if (!CitizenConversationPhoneNormalizer.TryFindConversationId(byPhone, normalized, out var conversationId))
            {
                var conversation = new CitizenConversation
                {
                    CitizenConversationId = Guid.NewGuid(),
                    TenantId = tenantId,
                    CitizenPhone = normalized,
                    CitizenName = string.IsNullOrWhiteSpace(orphan.JobCitizenName) ? null : orphan.JobCitizenName.Trim(),
                    Neighborhood = string.IsNullOrWhiteSpace(orphan.JobNeighborhood) ? null : orphan.JobNeighborhood.Trim(),
                    Street = string.IsNullOrWhiteSpace(orphan.JobStreet) ? null : orphan.JobStreet.Trim(),
                    OpenAddress = string.IsNullOrWhiteSpace(orphan.JobOpenAddress) ? null : orphan.JobOpenAddress.Trim(),
                    LastMessageAt = DateTimeOffset.UtcNow,
                    UnreadCount = 0,
                };
                _dbContext.CitizenConversations.Add(conversation);
                conversationId = conversation.CitizenConversationId;
                byPhone[normalized] = conversationId;
                changed = true;
            }
            else if (await CitizenConversationLinkGuard.ShouldSkipPhoneLinkToConversationAsync(
                _dbContext,
                tenantId,
                orphan.Channel,
                conversationId,
                cancellationToken))
            {
                continue;
            }

            var message = await _dbContext.SocialMessages
                .FirstAsync(item => item.SocialMessageId == orphan.SocialMessageId, cancellationToken);
            message.CitizenConversationId = conversationId;
            changed = true;
        }

        if (changed)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
