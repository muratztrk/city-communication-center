using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Abstractions;

public interface ICitizenJobStatusNotifier
{
    Task NotifyCreatedAsync(
        Guid tenantId,
        SocialMessage message,
        Job job,
        int taskCount,
        CancellationToken cancellationToken = default);

    Task NotifyStatusChangedAsync(
        Guid tenantId,
        Guid jobId,
        string previousDisplayStatus,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Terminal (Tamamlanmış/İptal) vatandaş durum mesajını Manager/CRM onayıyla operatör
    /// WhatsApp ekranına Pending olarak serbest bırakır (card #2039). Zaten serbest bırakılmışsa no-op.
    /// Çağrı (Phone) ikinci aşamada gerçek SMS gönderir; başarısızsa <c>false</c> döner (#6a75eea2).
    /// </summary>
    Task<bool> ReleaseTerminalMessagesAsync(
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken = default);
}
