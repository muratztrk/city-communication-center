using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
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

    public static bool IsUndeliveredOutboundForWhatsAppApproval(
        ConversationEntryDirection direction,
        ConversationDeliveryStatus? deliveryStatus,
        string? deliveryError)
    {
        if (direction != ConversationEntryDirection.Outbound)
        {
            return false;
        }

        if (deliveryStatus == ConversationDeliveryStatus.Pending)
        {
            return true;
        }

        return deliveryStatus == ConversationDeliveryStatus.Failed
            && WhatsAppServiceWindow.IsReEngagementError(deliveryError);
    }

    public static bool CountsForWhatsAppPendingMessageApproval(
        ConversationEntryDirection direction,
        ConversationDeliveryStatus? deliveryStatus,
        string? senderLabel,
        string? content,
        DateTimeOffset? jobTerminalMessageReleasedAtUtc)
        => CountsForWhatsAppPendingMessageApproval(
            direction,
            deliveryStatus,
            deliveryError: null,
            senderLabel,
            content,
            jobTerminalMessageReleasedAtUtc);

    public static bool CountsForWhatsAppPendingMessageApproval(
        ConversationEntryDirection direction,
        ConversationDeliveryStatus? deliveryStatus,
        string? deliveryError,
        string? senderLabel,
        string? content,
        DateTimeOffset? jobTerminalMessageReleasedAtUtc)
    {
        if (!IsUndeliveredOutboundForWhatsAppApproval(direction, deliveryStatus, deliveryError))
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
        await ApplyCitizenMessageApprovalReleasedFallbackAsync(
            dbContext,
            tenantId,
            releasedByJobId,
            cancellationToken);
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

    /// <summary>
    /// Yönetici Mesajı Onayla audit'i var ama ReleasedAtUtc basılmamış kayıtlarda
    /// operatör WA kuyruğu açılsın (#3761).
    /// </summary>
    public static async Task ApplyCitizenMessageApprovalReleasedFallbackAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Dictionary<Guid, DateTimeOffset?> releasedAtByJobId,
        CancellationToken cancellationToken)
    {
        var missingJobIds = releasedAtByJobId
            .Where(pair => pair.Value is null)
            .Select(pair => pair.Key)
            .ToList();
        if (missingJobIds.Count == 0)
        {
            return;
        }

        var entityIds = missingJobIds.Select(id => id.ToString()).ToList();
        var audits = await dbContext.AuditLogs
            .AsNoTracking()
            .Where(audit => audit.TenantId == tenantId
                && audit.EntityType == nameof(Job)
                && audit.Action == "CitizenMessageApprovalReleased"
                && entityIds.Contains(audit.EntityId))
            .Select(audit => new { audit.EntityId, audit.EventTimeUtc })
            .ToListAsync(cancellationToken);

        foreach (var group in audits.GroupBy(audit => audit.EntityId))
        {
            if (!Guid.TryParse(group.Key, out var jobId))
            {
                continue;
            }

            releasedAtByJobId[jobId] = group.Max(item => item.EventTimeUtc);
        }
    }
}
