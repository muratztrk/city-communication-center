using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Abstractions;

public interface IAfterHoursJobSmsNotifier
{
    /// <summary>Mesai dışı talep oluşturulunca yönetici/sorumlu/VTY SMS'i.</summary>
    Task NotifyJobCreatedAsync(Job job, IReadOnlyCollection<Guid> departmentIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Mesai dışı görev atanınca personel SMS'i. Müdür atlanır; atanan VTY veya birim
    /// sorumlusu ikinci SMS alır. Standart personel mantığı aynı kalır.
    /// </summary>
    Task NotifyTaskAssignedAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        CancellationToken cancellationToken = default);
}
