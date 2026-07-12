namespace CityCommunicationCenter.Application.Features.InternalMessages;

// İki kullanıcı arasında tek bir konuşma satırı garantisi için çift her zaman aynı sırada
// normalize edilir (küçük Guid önce) — kim başlatırsa başlatsın aynı konuşma bulunur (card #1539).
internal static class InternalConversationHelper
{
    public static (Guid UserAId, Guid UserBId) NormalizePair(Guid userId1, Guid userId2) =>
        userId1.CompareTo(userId2) <= 0 ? (userId1, userId2) : (userId2, userId1);
}
