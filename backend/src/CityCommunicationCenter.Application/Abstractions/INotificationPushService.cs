namespace CityCommunicationCenter.Application.Abstractions;

public interface INotificationPushService
{
    Task SendToUserAsync(Guid tenantId, Guid userId, NotificationPayload payload, CancellationToken cancellationToken = default);
    Task SendToTenantAsync(Guid tenantId, NotificationPayload payload, CancellationToken cancellationToken = default);
    Task SendWhatsAppMessageToTenantAsync(Guid tenantId, WhatsAppMessagePayload payload, CancellationToken cancellationToken = default);
}

public sealed record NotificationPayload(
    Guid NotificationId,
    string Title,
    string Message,
    string? ActionUrl = null);

public sealed record WhatsAppMessagePayload(
    Guid CitizenConversationId,
    string CitizenPhone,
    string? CitizenName,
    string? MessagePreview,
    int UnreadCount,
    DateTimeOffset LastMessageAt,
    // Birim içi (Kurum İçi İlet) mesaj bildirimi; istemci aktif konuşmada otomatik
    // okundu-işaretlemeyi atlar (card #1295).
    bool IsInternal = false,
    // İçerik değil teslim durumu (sent/delivered/read) güncellendi; istemci açık konuşmayı yeniler
    // ama okundu yazmaz.
    bool IsStatusUpdate = false,
    // Birim içi mesajı gönderen kullanıcı — istemci kendi gönderdiği mesaj için bildirim/pulse
    // göstermesin diye (card #1495).
    Guid? SenderUserId = null);
