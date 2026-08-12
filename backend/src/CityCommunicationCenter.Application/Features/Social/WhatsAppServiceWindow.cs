using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Application.Features.Social;

internal static class WhatsAppServiceWindow
{
    public static bool IsWindowOpen(DateTimeOffset? lastInboundAt, DateTimeOffset now) =>
        lastInboundAt.HasValue && (now - lastInboundAt.Value) < TimeSpan.FromHours(24);

    public static bool IsReEngagementError(string? error) =>
        !string.IsNullOrWhiteSpace(error)
        && error.Contains("re-engagement", StringComparison.OrdinalIgnoreCase);

    public static bool IsRetryableOutboundEntry(SocialConversationEntry entry, bool windowOpen) =>
        entry.Direction == ConversationEntryDirection.Outbound
        && (entry.DeliveryStatus == ConversationDeliveryStatus.Pending
            || (windowOpen
                && entry.DeliveryStatus == ConversationDeliveryStatus.Failed
                && IsReEngagementError(entry.DeliveryError)));

    public static async Task<DateTimeOffset?> GetLastInboundAtUtcAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        SocialMessage message,
        CancellationToken cancellationToken)
    {
        if (message.CitizenConversationId is null)
        {
            return await dbContext.ConversationEntries
                .AsNoTracking()
                .Where(e => e.SocialMessageId == message.SocialMessageId
                    && e.Direction == ConversationEntryDirection.Inbound)
                .OrderByDescending(e => e.SentAt)
                .Select(e => (DateTimeOffset?)e.SentAt)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var conversationMessageIds = await dbContext.SocialMessages
            .AsNoTracking()
            .Where(m => m.TenantId == tenantId
                && m.CitizenConversationId == message.CitizenConversationId)
            .Select(m => m.SocialMessageId)
            .ToListAsync(cancellationToken);

        if (conversationMessageIds.Count == 0)
        {
            conversationMessageIds = [message.SocialMessageId];
        }

        return await dbContext.ConversationEntries
            .AsNoTracking()
            .Where(e => conversationMessageIds.Contains(e.SocialMessageId)
                && e.Direction == ConversationEntryDirection.Inbound)
            .OrderByDescending(e => e.SentAt)
            .Select(e => (DateTimeOffset?)e.SentAt)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
