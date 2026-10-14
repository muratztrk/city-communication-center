namespace CityCommunicationCenter.Application.Features.Social;

public static class WhatsAppRecipientResolver
{
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
