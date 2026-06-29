namespace CityCommunicationCenter.Domain.Enums;

public enum ConversationDeliveryStatus
{
    /// <summary>Yanıt kuyruğa alındı; vatandaşa henüz iletilmedi. Yalnızca Vatandaş Operatörü
    /// "Mesajı Gönder" ile iletebilir (card #1091).</summary>
    Pending,
    Sent,
    Delivered,
    Read,
    Failed
}
