namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetWhatsAppMessageApprovalLogsQuery(string? Kind) : IQuery<IReadOnlyList<WhatsAppMessageApprovalLogItemResponse>>;

public sealed class GetWhatsAppMessageApprovalLogsQueryHandler
    : IQueryHandler<GetWhatsAppMessageApprovalLogsQuery, IReadOnlyList<WhatsAppMessageApprovalLogItemResponse>>
{
    private const int MaxItems = 2000;

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetWhatsAppMessageApprovalLogsQueryHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<WhatsAppMessageApprovalLogItemResponse>> Handle(
        GetWhatsAppMessageApprovalLogsQuery request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();
        var kind = request.Kind?.Trim();
        if (string.Equals(kind, "requestCreated", StringComparison.OrdinalIgnoreCase))
        {
            return await LoadRequestCreatorsAsync(tenantId, cancellationToken);
        }

        var includeWaiting = kind is null or "" or "all" or "waitingReplied";
        var includeCleared = kind is null or "" or "all" or "pendingApprovalCleared";
        var includeRelayed = kind is null or "" or "all" or "messageRelayed";
        var includeReviewRequested = kind is null or "" or "all" or "reviewRequested";

        var rows = new List<WhatsAppMessageApprovalLogItemResponse>();
        if (includeWaiting || includeCleared)
        {
            var actions = new List<string>(2);
            if (includeWaiting) actions.Add(WhatsAppMessageApprovalLog.WaitingRepliedAction);
            if (includeCleared) actions.Add(WhatsAppMessageApprovalLog.PendingApprovalClearedAction);

            rows.AddRange(await LoadApprovalActionsAsync(tenantId, actions, cancellationToken));
        }

        if (includeRelayed)
        {
            rows.AddRange(await LoadRelayedAsync(tenantId, cancellationToken));
        }

        if (includeReviewRequested)
        {
            rows.AddRange(await LoadReviewRequestedAsync(tenantId, cancellationToken));
        }

        return rows
            .OrderByDescending(row => row.EventTimeUtc)
            .Take(MaxItems)
            .ToList();
    }

    private async Task<List<WhatsAppMessageApprovalLogItemResponse>> LoadApprovalActionsAsync(
        Guid tenantId,
        IReadOnlyList<string> actions,
        CancellationToken cancellationToken)
    {
        var logs = await _dbContext.AuditLogs.AsNoTracking()
            .Where(log => log.TenantId == tenantId
                && log.EntityType == nameof(CitizenConversation)
                && actions.Contains(log.Action))
            .OrderByDescending(log => log.EventTimeUtc)
            .Take(MaxItems)
            .Select(log => new
            {
                log.AuditLogId,
                log.Details,
                log.Notes,
                log.EventTimeUtc,
                log.Action,
                log.ActorDisplayName,
                log.EntityId,
            })
            .ToListAsync(cancellationToken);

        var conversationIds = logs
            .Select(log => Guid.TryParse(log.EntityId, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToArray();
        var conversations = conversationIds.Length == 0
            ? new Dictionary<Guid, (string? Phone, string? Username)>()
            : await _dbContext.CitizenConversations.AsNoTracking()
                .Where(conversation => conversation.TenantId == tenantId
                    && conversationIds.Contains(conversation.CitizenConversationId))
                .Select(conversation => new
                {
                    conversation.CitizenConversationId,
                    conversation.CitizenPhone,
                    conversation.WhatsAppUsername,
                })
                .ToDictionaryAsync(
                    conversation => conversation.CitizenConversationId,
                    conversation => (Phone: (string?)conversation.CitizenPhone, Username: conversation.WhatsAppUsername),
                    cancellationToken);

        return logs.Select(log =>
        {
            Guid.TryParse(log.EntityId, out var conversationId);
            conversations.TryGetValue(conversationId, out var conversation);
            var phone = FirstPhone(conversation.Phone, log.Notes);
            return new WhatsAppMessageApprovalLogItemResponse(
                log.AuditLogId,
                log.Details,
                phone,
                log.EventTimeUtc,
                log.Action,
                log.ActorDisplayName,
                null,
                null,
                null,
                null,
                null,
                null,
                string.IsNullOrWhiteSpace(phone) ? conversation.Username : null);
        }).ToList();
    }

    private static string? FirstPhone(string? currentPhone, string? snapshotPhone)
    {
        var live = PhoneOrNull(currentPhone);
        if (live is not null)
        {
            return live;
        }

        return PhoneOrNull(snapshotPhone);
    }

    private static string? PhoneOrNull(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || IsBusinessScopedUserId(trimmed))
        {
            return null;
        }

        var digits = 0;
        foreach (var ch in trimmed)
        {
            if (char.IsDigit(ch))
            {
                digits++;
            }
        }

        return digits is >= 10 and <= 15 ? trimmed : null;
    }

    private static string? NameOrNull(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || IsBusinessScopedUserId(trimmed))
        {
            return null;
        }

        return trimmed;
    }

    private static string? FirstName(params string?[] candidates)
    {
        foreach (var candidate in candidates)
        {
            var valid = NameOrNull(candidate);
            if (valid is not null)
            {
                return valid;
            }
        }

        return null;
    }

    private static bool IsBusinessScopedUserId(string value)
    {
        if (value.Length < 4 || value.Length > 128 || value[2] != '.')
        {
            return false;
        }

        if (!char.IsLetter(value[0]) || !char.IsLetter(value[1]))
        {
            return false;
        }

        for (var index = 3; index < value.Length; index++)
        {
            var ch = value[index];
            if (!char.IsLetterOrDigit(ch) && ch != '.')
            {
                return false;
            }
        }

        return true;
    }

    private async Task<List<WhatsAppMessageApprovalLogItemResponse>> LoadRelayedAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        return await (
            from entry in _dbContext.ConversationEntries.AsNoTracking()
            join message in _dbContext.SocialMessages.AsNoTracking()
                on entry.SocialMessageId equals message.SocialMessageId
            where message.TenantId == tenantId
                && message.Channel == SocialChannel.WhatsApp
                && entry.Direction == ConversationEntryDirection.Outbound
                && entry.RelayedByDisplayName != null
                && entry.RelayedByDisplayName != ""
                && (entry.DeliveryStatus == ConversationDeliveryStatus.Sent
                    || entry.DeliveryStatus == ConversationDeliveryStatus.Delivered
                    || entry.DeliveryStatus == ConversationDeliveryStatus.Read)
            join conversation in _dbContext.CitizenConversations.AsNoTracking()
                on message.CitizenConversationId equals conversation.CitizenConversationId into conversationJoin
            from conversation in conversationJoin.DefaultIfEmpty()
            orderby entry.SentAt descending
            select new WhatsAppMessageApprovalLogItemResponse(
                entry.EntryId,
                conversation != null ? conversation.CitizenName : null,
                conversation != null ? conversation.CitizenPhone : message.CitizenHandle,
                entry.SentAt,
                WhatsAppMessageApprovalLog.MessageRelayedAction,
                entry.RelayedByDisplayName,
                message.SocialMessageId,
                null,
                null,
                null,
                null,
                null,
                conversation != null ? conversation.WhatsAppUsername : null))
            .Take(MaxItems)
            .ToListAsync(cancellationToken);
    }

    private async Task<List<WhatsAppMessageApprovalLogItemResponse>> LoadReviewRequestedAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        return await (
            from review in _dbContext.CitizenConversationDepartmentReviews.AsNoTracking()
            where review.TenantId == tenantId
            join department in _dbContext.Departments.AsNoTracking()
                on review.DepartmentId equals department.DepartmentId
            join sender in _dbContext.Users.AsNoTracking()
                on review.RequestedByUserId equals sender.UserId
            join conversation in _dbContext.CitizenConversations.AsNoTracking()
                on review.CitizenConversationId equals conversation.CitizenConversationId into conversationJoin
            from conversation in conversationJoin.DefaultIfEmpty()
            join reviewer in _dbContext.Users.AsNoTracking()
                on review.UpdatedByUserId equals (Guid?)reviewer.UserId into reviewerJoin
            from reviewer in reviewerJoin.DefaultIfEmpty()
            orderby review.RequestedAtUtc descending
            select new WhatsAppMessageApprovalLogItemResponse(
                review.ReviewId,
                conversation != null ? conversation.CitizenName : null,
                conversation != null ? conversation.CitizenPhone : null,
                review.RequestedAtUtc,
                WhatsAppMessageApprovalLog.ReviewRequestedAction,
                sender.DisplayName,
                review.SocialMessageId,
                department.Name,
                review.AcknowledgedAtUtc != null && reviewer != null ? reviewer.DisplayName : null,
                null,
                null,
                null,
                conversation != null ? conversation.WhatsAppUsername : null))
            .Take(MaxItems)
            .ToListAsync(cancellationToken);
    }

    private async Task<List<WhatsAppMessageApprovalLogItemResponse>> LoadRequestCreatorsAsync(
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var rows = await (
            from job in _dbContext.Jobs.AsNoTracking()
            join message in _dbContext.SocialMessages.AsNoTracking()
                on job.JobId equals message.JobId
            where job.TenantId == tenantId
                && message.Channel == SocialChannel.WhatsApp
                && message.CitizenRequestNumber != null
            join creator in _dbContext.Users.AsNoTracking()
                on job.CreatedByUserId equals (Guid?)creator.UserId into creators
            from creator in creators.DefaultIfEmpty()
            join conversation in _dbContext.CitizenConversations.AsNoTracking()
                on message.CitizenConversationId equals conversation.CitizenConversationId into conversations
            from conversation in conversations.DefaultIfEmpty()
            orderby message.ReceivedAtUtc descending
            select new
            {
                job.JobId,
                JobCitizenName = job.CitizenName,
                JobCitizenPhone = job.CitizenPhone,
                MessageCitizenHandle = message.CitizenHandle,
                ConversationCitizenName = conversation != null ? conversation.CitizenName : null,
                ConversationCitizenPhone = conversation != null ? conversation.CitizenPhone : null,
                message.ReceivedAtUtc,
                CreatorDisplayName = creator != null ? creator.DisplayName : null,
                message.SocialMessageId,
                TargetDepartmentName = _dbContext.JobDepartments
                    .Where(link => link.JobId == job.JobId && link.Role == JobDepartmentRole.Target)
                    .Join(
                        _dbContext.Departments,
                        link => link.DepartmentId,
                        department => department.DepartmentId,
                        (_, department) => (string?)department.Name)
                    .FirstOrDefault(),
                message.CitizenRequestNumber,
                message.CitizenRequestNumberYear,
                WhatsAppUsername = conversation != null ? conversation.WhatsAppUsername : null,
            })
            .Take(MaxItems)
            .ToListAsync(cancellationToken);

        return rows.Select(row => new WhatsAppMessageApprovalLogItemResponse(
            row.JobId,
            FirstName(row.JobCitizenName, row.ConversationCitizenName, row.MessageCitizenHandle),
            FirstPhone(row.JobCitizenPhone, FirstPhone(row.ConversationCitizenPhone, row.MessageCitizenHandle)),
            row.ReceivedAtUtc,
            "WhatsAppRequestCreated",
            row.CreatorDisplayName,
            row.SocialMessageId,
            row.TargetDepartmentName,
            null,
            row.CitizenRequestNumber,
            row.CitizenRequestNumberYear,
            row.JobId,
            row.WhatsAppUsername)).ToList();
    }
}
