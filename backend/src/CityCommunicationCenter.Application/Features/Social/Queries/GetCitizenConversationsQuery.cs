using CityCommunicationCenter.Application.Features.Users;

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
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var currentUserId = context.UserId;
        var canSeeAllConversations = Enum.TryParse<RoleCode>(context.RoleCode, true, out var roleCode)
            && roleCode is RoleCode.Operator or RoleCode.SystemAdmin;

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

        return conversations
            .Select(c =>
            {
                latestTicketByConversation.TryGetValue(c.CitizenConversationId, out var ticket);
                string? assigneeDisplayName = null;
                if (ticket?.JobId is Guid jobId && assigneeByJobId.TryGetValue(jobId, out var name) && !string.IsNullOrWhiteSpace(name))
                {
                    assigneeDisplayName = name;
                }

                var conversationMessages = socialMessages
                    .Where(m => m.ConversationId == c.CitizenConversationId)
                    .ToList();
                var hasActiveJob = conversationMessages.Any(m => m.JobStatus is not null and not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected));
                var isRelevantToCurrentUser = canSeeAllConversations
                    ? hasActiveJob || c.OpenTicketCount > 0
                    : conversationMessages.Any(m => m.JobId is Guid messageJobId && relevantJobIds.Contains(messageJobId)
                        && m.JobStatus is not (JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected));

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
                    isRelevantToCurrentUser,
                    conversationMessages.Count(m => m.JobStatus is JobStatus.Draft or JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval or JobStatus.RevisionRequested),
                    conversationMessages.Count(m => m.JobStatus == JobStatus.Active),
                    conversationMessages.Count(m => m.JobStatus == JobStatus.Completed),
                    conversationMessages.Count(m => m.JobStatus is JobStatus.Cancelled or JobStatus.Rejected),
                    c.Label,
                    c.Neighborhood,
                    c.Street,
                    c.OpenAddress);
            })
            .ToList();
    }
}
