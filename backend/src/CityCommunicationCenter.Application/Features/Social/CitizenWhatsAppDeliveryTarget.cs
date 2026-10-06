using CityCommunicationCenter.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Aynı konuşmada yanıtlanmamış WhatsApp inbound varken vatandaş bildirimi/yanıtı
/// çağrı SMS'ine değil o WhatsApp thread'ine gider.
/// </summary>
public static class CitizenWhatsAppDeliveryTarget
{
    public static async Task<SocialMessage> ResolveDeliveryMessageAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        SocialMessage sourceMessage,
        CancellationToken cancellationToken)
    {
        if (sourceMessage.Channel == SocialChannel.WhatsApp)
        {
            return sourceMessage;
        }

        var unanswered = await FindUnansweredWhatsAppMessageAsync(
            dbContext,
            tenantId,
            sourceMessage.CitizenConversationId,
            cancellationToken);
        return unanswered ?? sourceMessage;
    }

    /// <summary>
    /// Personel/operatör yanıtı (Yazışmaya Git): konuşmada WhatsApp thread'i varsa, son WhatsApp
    /// kaydı yanıtlanmış olsa bile yanıt o thread'e gider; aksi halde telefon kaydında durumsuz
    /// yerel not olarak kalır ve vatandaşa ulaşmaz.
    /// </summary>
    public static async Task<SocialMessage> ResolveReplyMessageAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        SocialMessage sourceMessage,
        CancellationToken cancellationToken)
    {
        if (sourceMessage.Channel == SocialChannel.WhatsApp)
        {
            return sourceMessage;
        }

        var unanswered = await FindUnansweredWhatsAppMessageAsync(
            dbContext,
            tenantId,
            sourceMessage.CitizenConversationId,
            cancellationToken);
        if (unanswered is not null)
        {
            return unanswered;
        }

        if (sourceMessage.CitizenConversationId is not Guid conversationId)
        {
            return sourceMessage;
        }

        var latestWhatsAppMessage = await dbContext.SocialMessages
            .Where(message => message.TenantId == tenantId
                && message.CitizenConversationId == conversationId
                && message.Channel == SocialChannel.WhatsApp)
            .OrderByDescending(message => dbContext.ConversationEntries
                .Where(entry => entry.SocialMessageId == message.SocialMessageId)
                .Max(entry => (DateTimeOffset?)entry.SentAt) ?? message.ReceivedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        return latestWhatsAppMessage ?? sourceMessage;
    }

    public static async Task<SocialMessage?> FindUnansweredWhatsAppMessageAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid? conversationId,
        CancellationToken cancellationToken)
    {
        if (conversationId is not Guid id)
        {
            return null;
        }

        var latestWhatsAppEntry = await dbContext.ConversationEntries
            .AsNoTracking()
            .Where(entry => dbContext.SocialMessages.Any(message =>
                message.SocialMessageId == entry.SocialMessageId
                && message.TenantId == tenantId
                && message.CitizenConversationId == id
                && message.Channel == SocialChannel.WhatsApp))
            .OrderByDescending(entry => entry.SentAt)
            .ThenByDescending(entry => entry.EntryId)
            .Select(entry => new { entry.SocialMessageId, entry.Direction })
            .FirstOrDefaultAsync(cancellationToken);

        if (latestWhatsAppEntry is null
            || latestWhatsAppEntry.Direction != ConversationEntryDirection.Inbound)
        {
            return null;
        }

        return await dbContext.SocialMessages.FirstOrDefaultAsync(
            message => message.SocialMessageId == latestWhatsAppEntry.SocialMessageId
                && message.TenantId == tenantId,
            cancellationToken);
    }
}
