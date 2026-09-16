using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// WA operatör görünümü: yönetici onayı bekleyen terminal (Tamamlandı/İptal) Pending
/// balonları timeline'da gizlenir (#3736).
/// </summary>
public static class ConversationEntryOperatorVisibility
{
    public static bool IsTerminalPendingAwaitingManagerRelease(
        ConversationEntryDirection direction,
        ConversationDeliveryStatus? deliveryStatus,
        string? senderLabel,
        string? content,
        DateTimeOffset? jobTerminalMessageReleasedAtUtc)
    {
        if (direction != ConversationEntryDirection.Outbound
            || deliveryStatus != ConversationDeliveryStatus.Pending)
        {
            return false;
        }

        if (!ConversationEntrySenderLabelHelper.IsAutomaticOutbound(direction, deliveryStatus, senderLabel, content))
        {
            return false;
        }

        return !jobTerminalMessageReleasedAtUtc.HasValue;
    }

    public static bool CountsForWhatsAppPendingMessageApproval(
        ConversationEntryDirection direction,
        ConversationDeliveryStatus? deliveryStatus,
        string? senderLabel,
        string? content,
        DateTimeOffset? jobTerminalMessageReleasedAtUtc)
    {
        if (direction != ConversationEntryDirection.Outbound
            || deliveryStatus != ConversationDeliveryStatus.Pending)
        {
            return false;
        }

        if (!ConversationEntrySenderLabelHelper.IsAutomaticOutbound(direction, deliveryStatus, senderLabel, content))
        {
            return true;
        }

        return jobTerminalMessageReleasedAtUtc.HasValue;
    }

    public static async Task<Dictionary<Guid, DateTimeOffset?>> ResolveReleasedAtByMessageIdAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        IReadOnlyCollection<Guid> messageIds,
        CancellationToken cancellationToken)
    {
        if (messageIds.Count == 0)
        {
            return new Dictionary<Guid, DateTimeOffset?>();
        }

        var linkedMessages = await dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId && messageIds.Contains(m.SocialMessageId))
            .Select(m => new { m.SocialMessageId, m.JobId })
            .ToListAsync(cancellationToken);

        var jobIds = linkedMessages
            .Where(m => m.JobId.HasValue)
            .Select(m => m.JobId!.Value)
            .Distinct()
            .ToList();
        var jobs = jobIds.Count == 0
            ? []
            : await dbContext.Jobs
                .AsNoTracking()
                .Where(j => j.TenantId == tenantId && jobIds.Contains(j.JobId))
                .Select(j => new { j.JobId, j.SourceRefId, j.CitizenTerminalMessageReleasedAtUtc })
                .ToListAsync(cancellationToken);

        var releasedByJobId = jobs.ToDictionary(j => j.JobId, j => j.CitizenTerminalMessageReleasedAtUtc);
        var releasedBySourceRef = jobs
            .Where(j => j.SourceRefId.HasValue)
            .ToDictionary(j => j.SourceRefId!.Value, j => j.CitizenTerminalMessageReleasedAtUtc);

        var result = new Dictionary<Guid, DateTimeOffset?>();
        foreach (var linkedMessage in linkedMessages)
        {
            DateTimeOffset? releasedAt = null;
            if (linkedMessage.JobId.HasValue
                && releasedByJobId.TryGetValue(linkedMessage.JobId.Value, out var byJob))
            {
                releasedAt = byJob;
            }
            else if (releasedBySourceRef.TryGetValue(linkedMessage.SocialMessageId, out var bySource))
            {
                releasedAt = bySource;
            }

            result[linkedMessage.SocialMessageId] = releasedAt;
        }

        return result;
    }
}
