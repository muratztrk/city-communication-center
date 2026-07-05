using CityCommunicationCenter.Application.Abstractions;

namespace CityCommunicationCenter.Application.Features.Notifications;

internal static class InAppNotificationSender
{
    // Bildirim feed'i (GetNotificationsQuery) workflow olaylarını zaten AuditLog'lardan türetir;
    // burada ayrıca kalıcı Notification satırı yazılırsa aynı olay feed'de İKİ KEZ görünür
    // (card #1386 — ek süre talebi mükerrer bildirimi). Bu yardımcı yalnızca gerçek zamanlı
    // SignalR push (toast + rozet yenileme) gönderir; kalıcı kayıt audit'ten gelir.
    public static async Task SendAsync(
        INotificationPushService pushService,
        Guid tenantId,
        Guid recipientUserId,
        string title,
        string message,
        string? actionUrl,
        CancellationToken cancellationToken)
    {
        if (recipientUserId == Guid.Empty)
        {
            return;
        }

        await pushService.SendToUserAsync(
            tenantId,
            recipientUserId,
            new NotificationPayload(Guid.NewGuid(), title, message, actionUrl),
            cancellationToken);
    }
}
