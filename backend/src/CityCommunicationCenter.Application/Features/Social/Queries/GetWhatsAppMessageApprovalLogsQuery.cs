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

            rows.AddRange(await _dbContext.AuditLogs.AsNoTracking()
                .Where(log => log.TenantId == tenantId
                    && log.EntityType == nameof(CitizenConversation)
                    && actions.Contains(log.Action))
                .OrderByDescending(log => log.EventTimeUtc)
                .Take(MaxItems)
                .Select(log => new WhatsAppMessageApprovalLogItemResponse(
                    log.AuditLogId,
                    log.Details,
                    log.Notes,
                    log.EventTimeUtc,
                    log.Action,
                    log.ActorDisplayName,
                    null))
                .ToListAsync(cancellationToken));
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
                message.SocialMessageId))
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
                review.AcknowledgedAtUtc != null && reviewer != null ? reviewer.DisplayName : null))
            .Take(MaxItems)
            .ToListAsync(cancellationToken);
    }
}
