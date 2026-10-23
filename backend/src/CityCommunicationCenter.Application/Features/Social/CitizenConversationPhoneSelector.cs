using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Features.Social;

/// <summary>
/// Aynı numaranın ülke kodlu ve ülke kodsuz satırı bir arada durunca
/// talep kaydı ülke kodlu satırı seçer. Diğer satırın telefonu ezilmez (#6a6f1d32).
/// </summary>
internal static class CitizenConversationPhoneSelector
{
    public static CitizenConversation? PreferCanonical(
        IReadOnlyList<CitizenConversation> matches,
        string normalizedPhone)
    {
        if (matches.Count == 0)
        {
            return null;
        }

        return matches.FirstOrDefault(item =>
                string.Equals(item.CitizenPhone, normalizedPhone, StringComparison.Ordinal))
            ?? matches[0];
    }
}
