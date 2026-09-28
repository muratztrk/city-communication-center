using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>Geciken vatandaş talepleri için yönetici/sorumlu/VTY SMS bildirimi.</summary>
public interface IOverdueJobSmsNotifier
{
    Task ProcessOverdueJobsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Tek talep gecikmişse mesai saati kontrolü olmadan hemen SMS dener (dedup: başarılı log).
    /// </summary>
    Task NotifyJobOverdueIfNeededAsync(Job job, CancellationToken cancellationToken = default);
}
