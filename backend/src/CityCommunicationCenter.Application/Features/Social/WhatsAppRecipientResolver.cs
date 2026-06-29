namespace CityCommunicationCenter.Application.Features.Social;

internal static class WhatsAppRecipientResolver
{
    public static async Task<string?> ResolveRecipientPhoneAsync(
        IApplicationDbContext dbContext,
        SocialMessage message,
        CancellationToken cancellationToken)
    {
        if (message.CitizenConversationId.HasValue)
        {
            var conversationPhone = await dbContext.CitizenConversations
                .AsNoTracking()
                .Where(c => c.CitizenConversationId == message.CitizenConversationId.Value)
                .Select(c => c.CitizenPhone)
                .FirstOrDefaultAsync(cancellationToken);

            if (LooksLikePhone(conversationPhone))
            {
                return NormalizePhoneDigits(conversationPhone!);
            }
        }

        if (LooksLikePhone(message.CitizenHandle))
        {
            return NormalizePhoneDigits(message.CitizenHandle);
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
