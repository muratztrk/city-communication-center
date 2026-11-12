namespace CityCommunicationCenter.Application.Features.Social;

public static class WhatsAppRecipientResolver
{
    /// <summary>
    /// WhatsApp gönderim hedefi. Son gelen mesajın kimliği (wa_id veya BSUID) vardırsa o kullanılır.
    /// Konuşmaya sonradan yazılan talep telefonu bu hedefi değiştirmez. SMS için
    /// <see cref="ResolveRecipientPhoneAsync"/> durur.
    /// </summary>
    public static async Task<string?> ResolveWhatsAppRecipientAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        SocialMessage message,
        CancellationToken cancellationToken)
    {
        var windowRecipient = await ResolveWindowRecipientAsync(dbContext, tenantId, message, cancellationToken);
        if (!string.IsNullOrWhiteSpace(windowRecipient))
        {
            return windowRecipient;
        }

        return await ResolveRecipientPhoneAsync(dbContext, message, cancellationToken);
    }

    public static async Task<string?> ResolveRecipientPhoneAsync(
        IApplicationDbContext dbContext,
        SocialMessage message,
        CancellationToken cancellationToken)
    {
        if (message.CitizenConversationId.HasValue)
        {
            var conversation = await dbContext.CitizenConversations
                .AsNoTracking()
                .Where(c => c.CitizenConversationId == message.CitizenConversationId.Value)
                .Select(c => new { c.CitizenPhone, c.WhatsAppUserId })
                .FirstOrDefaultAsync(cancellationToken);

            if (LooksLikePhone(conversation?.CitizenPhone))
            {
                return NormalizePhoneDigits(conversation!.CitizenPhone);
            }

            if (WhatsAppBusinessScopedUserId.IsValid(conversation?.WhatsAppUserId))
            {
                return conversation!.WhatsAppUserId!.Trim();
            }

            if (WhatsAppBusinessScopedUserId.IsValid(conversation?.CitizenPhone))
            {
                return conversation!.CitizenPhone.Trim();
            }
        }

        if (LooksLikePhone(message.CitizenHandle))
        {
            return NormalizePhoneDigits(message.CitizenHandle);
        }

        if (WhatsAppBusinessScopedUserId.IsValid(message.CitizenHandle))
        {
            return message.CitizenHandle.Trim();
        }

        // Çağrı / form taleplerinde konuşma telefonu yoksa Job.CitizenPhone (#6a75eea2).
        if (message.JobId.HasValue)
        {
            var jobPhone = await dbContext.Jobs
                .AsNoTracking()
                .Where(job => job.JobId == message.JobId.Value)
                .Select(job => job.CitizenPhone)
                .FirstOrDefaultAsync(cancellationToken);

            if (LooksLikePhone(jobPhone))
            {
                return NormalizePhoneDigits(jobPhone!);
            }
        }

        return null;
    }

    private static async Task<string?> ResolveWindowRecipientAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        SocialMessage message,
        CancellationToken cancellationToken)
    {
        List<Guid> messageIds;
        if (message.CitizenConversationId is Guid conversationId)
        {
            messageIds = await dbContext.SocialMessages
                .AsNoTracking()
                .Where(item => item.TenantId == tenantId && item.CitizenConversationId == conversationId)
                .Select(item => item.SocialMessageId)
                .ToListAsync(cancellationToken);
            if (messageIds.Count == 0)
            {
                messageIds = [message.SocialMessageId];
            }
        }
        else
        {
            messageIds = [message.SocialMessageId];
        }

        var recentInboundIds = await dbContext.ConversationEntries
            .AsNoTracking()
            .Where(entry => messageIds.Contains(entry.SocialMessageId)
                && entry.Direction == ConversationEntryDirection.Inbound
                && entry.ExternalEntryId != null
                && entry.ExternalEntryId != "")
            .OrderByDescending(entry => entry.SentAt)
            .Select(entry => entry.ExternalEntryId)
            .Take(20)
            .ToListAsync(cancellationToken);

        foreach (var externalId in recentInboundIds)
        {
            var identity = WhatsAppInboundIdentity.FromMessageId(externalId);
            if (WhatsAppBusinessScopedUserId.IsValid(identity))
            {
                return identity!.Trim();
            }

            if (LooksLikePhone(identity))
            {
                return NormalizePhoneDigits(identity!);
            }
        }

        return null;
    }

    internal static bool LooksLikePhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var digits = NormalizePhoneDigits(value);
        return digits.Length is >= 10 and <= 15;
    }

    internal static string NormalizePhoneDigits(string value)
        => new(value.Where(char.IsDigit).ToArray());
}
