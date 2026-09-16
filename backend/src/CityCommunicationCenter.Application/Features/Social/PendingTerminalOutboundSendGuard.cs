using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Terminal otomatik Pending WA mesajlarının mükerrer API gönderimini engeller (#3737).
/// </summary>
public static class PendingTerminalOutboundSendGuard
{
    internal const string SendClaimPrefix = "__sending:";

    public static bool IsTerminalAutomaticOutbound(SocialConversationEntry entry) =>
        entry.Direction == ConversationEntryDirection.Outbound
        && entry.DeliveryStatus == ConversationDeliveryStatus.Pending
        && ConversationEntrySenderLabelHelper.IsAutomaticOutbound(
            entry.Direction,
            entry.DeliveryStatus,
            entry.SenderLabel,
            entry.Content)
        && ConversationEntrySenderLabelHelper.IsTerminalCitizenStatusOutboundContent(entry.Content);

    public static async Task<IReadOnlyList<Guid>> ResolveConversationMessageIdsAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        SocialMessage message,
        CancellationToken cancellationToken)
    {
        if (message.CitizenConversationId is not Guid conversationId)
        {
            return [message.SocialMessageId];
        }

        return await dbContext.SocialMessages
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId && entity.CitizenConversationId == conversationId)
            .Select(entity => entity.SocialMessageId)
            .ToListAsync(cancellationToken);
    }

    public static async Task<bool> HasTransmittedDuplicateAsync(
        IApplicationDbContext dbContext,
        IReadOnlyCollection<Guid> messageIds,
        Guid entryId,
        string content,
        CancellationToken cancellationToken)
    {
        if (messageIds.Count == 0 || string.IsNullOrWhiteSpace(content))
        {
            return false;
        }

        return await dbContext.ConversationEntries
            .AsNoTracking()
            .AnyAsync(
                entity => messageIds.Contains(entity.SocialMessageId)
                    && entity.EntryId != entryId
                    && entity.Direction == ConversationEntryDirection.Outbound
                    && (entity.DeliveryStatus == ConversationDeliveryStatus.Sent
                        || entity.DeliveryStatus == ConversationDeliveryStatus.Delivered
                        || entity.DeliveryStatus == ConversationDeliveryStatus.Read)
                    && entity.Content == content,
                cancellationToken);
    }

    public static async Task<int> TryClaimPendingSendAsync(
        IApplicationDbContext dbContext,
        Guid socialMessageId,
        Guid entryId,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        var claimToken = $"{SendClaimPrefix}{entryId:N}";
        return await dbContext.ConversationEntries
            .Where(entity => entity.EntryId == entryId
                && entity.SocialMessageId == socialMessageId
                && (entity.DeliveryStatus == ConversationDeliveryStatus.Pending
                    || entity.DeliveryStatus == ConversationDeliveryStatus.Failed)
                && (entity.ExternalEntryId == null
                    || entity.ExternalEntryId.StartsWith(SendClaimPrefix, StringComparison.Ordinal)))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(entity => entity.DeliveryStatus, ConversationDeliveryStatus.Pending)
                    .SetProperty(entity => entity.DeliveryError, (string?)null)
                    .SetProperty(entity => entity.ExternalEntryId, claimToken)
                    .SetProperty(entity => entity.DeliveryStatusUpdatedAtUtc, utcNow),
                cancellationToken);
    }

    public static async Task MarkDuplicatePendingSiblingsAsTransmittedAsync(
        IApplicationDbContext dbContext,
        IReadOnlyCollection<Guid> messageIds,
        Guid sentEntryId,
        string content,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        if (messageIds.Count == 0 || string.IsNullOrWhiteSpace(content))
        {
            return;
        }

        await dbContext.ConversationEntries
            .Where(entity => messageIds.Contains(entity.SocialMessageId)
                && entity.EntryId != sentEntryId
                && entity.Direction == ConversationEntryDirection.Outbound
                && entity.DeliveryStatus == ConversationDeliveryStatus.Pending
                && entity.Content == content)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(entity => entity.DeliveryStatus, ConversationDeliveryStatus.Sent)
                    .SetProperty(entity => entity.DeliveryError, (string?)null)
                    .SetProperty(entity => entity.ExternalEntryId, (string?)null)
                    .SetProperty(entity => entity.SentAt, utcNow)
                    .SetProperty(entity => entity.DeliveryStatusUpdatedAtUtc, utcNow),
                cancellationToken);
    }
}
