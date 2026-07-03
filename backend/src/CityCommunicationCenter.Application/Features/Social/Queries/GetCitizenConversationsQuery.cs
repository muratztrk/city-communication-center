namespace CityCommunicationCenter.Application.Features.Social;

public sealed record GetCitizenConversationsQuery : IQuery<IReadOnlyList<CitizenConversationSummaryDto>>;

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
        var tenantId = _tenantContextAccessor.GetCurrent().RequireTenantId();

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
                c.OpenAddress,
                c.LastMessageAt,
                c.UnreadCount,
                c.IsBlocked,
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
                    .Select(e => e.Direction.ToString())
                    .FirstOrDefault(),
            })
            .ToListAsync(cancellationToken);

        if (conversations.Count == 0)
        {
            return [];
        }

        var conversationIds = conversations.Select(c => c.CitizenConversationId).ToList();

        var socialMessages = await _dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.CitizenConversationId != null && conversationIds.Contains(m.CitizenConversationId.Value))
            .Select(m => new
            {
                ConversationId = m.CitizenConversationId!.Value,
                m.Status,
                m.CitizenRequestNumber,
                m.CitizenRequestNumberYear,
                m.ReceivedAtUtc,
                m.JobId,
                JobStatus = m.Job != null ? (JobStatus?)m.Job.Status : null,
                Priority = m.Job != null ? m.Job.Priority : null,
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

        var assigneeByJobId = new Dictionary<Guid, string>();
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
        }

        return conversations
            .Select(c =>
            {
                latestTicketByConversation.TryGetValue(c.CitizenConversationId, out var ticket);
                string? assigneeDisplayName = null;
                if (ticket?.JobId is Guid jobId && assigneeByJobId.TryGetValue(jobId, out var name) && !string.IsNullOrWhiteSpace(name))
                {
                    assigneeDisplayName = name;
                }

                return new CitizenConversationSummaryDto(
                    c.CitizenConversationId,
                    c.CitizenPhone,
                    c.CitizenName,
                    c.LastMessageAt,
                    c.UnreadCount,
                    c.IsBlocked,
                    c.LastMessagePreview,
                    c.OpenTicketCount,
                    c.LastMessageDirection,
                    ticket?.CitizenRequestNumber,
                    ticket?.CitizenRequestNumberYear,
                    ticket?.Priority,
                    ticket?.Status.ToString(),
                    assigneeDisplayName,
                    socialMessages.Count(m => m.ConversationId == c.CitizenConversationId
                        && m.JobStatus is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested),
                    socialMessages.Count(m => m.ConversationId == c.CitizenConversationId && m.JobStatus == JobStatus.Active),
                    socialMessages.Count(m => m.ConversationId == c.CitizenConversationId && m.JobStatus == JobStatus.Completed),
                    socialMessages.Count(m => m.ConversationId == c.CitizenConversationId
                        && m.JobStatus is JobStatus.Cancelled or JobStatus.Rejected),
                    c.Label,
                    c.Neighborhood,
                    c.Street,
                    c.OpenAddress);
            })
            .ToList();
    }
}
