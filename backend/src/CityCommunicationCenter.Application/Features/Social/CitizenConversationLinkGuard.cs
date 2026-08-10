namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Phone (çağrı) VT'lerinin mevcut WhatsApp konuşmalarına bağlanmasını engeller (#2288/#2330).
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

    public static async Task<bool> ShouldSkipPhoneLinkToConversationAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        SocialChannel messageChannel,
        Guid conversationId,
        CancellationToken cancellationToken)
    {
        if (messageChannel != SocialChannel.Phone)
        {
            return false;
        }

        return await HasWhatsAppMessagesOnConversationAsync(
            dbContext,
            tenantId,
            conversationId,
            cancellationToken);
    }
}
