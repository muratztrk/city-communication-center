namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Aynı numaradaki WhatsApp konuşması ile çağrı VT'si birlikte yaşar; çağrı profil
/// yazarken mevcut WA adını ezmez (#2288/#2330). İki kanal aynı konuşmada ayrı
/// SocialMessage/Job olarak durur — bağlantı atlanmaz.
/// </summary>
internal static class CitizenConversationLinkGuard
{
    public static async Task<bool> HasWhatsAppMessagesOnConversationAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        return await dbContext.SocialMessages
            .AsNoTracking()
            .AnyAsync(
                message => message.TenantId == tenantId
                    && message.CitizenConversationId == conversationId
                    && message.Channel == SocialChannel.WhatsApp,
                cancellationToken);
    }

}
