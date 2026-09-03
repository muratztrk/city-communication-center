using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Abstractions;

public interface IAfterHoursJobSmsNotifier
{
    /// <summary>Mesai dışı talep oluşturulunca yönetici/sorumlu/VTY SMS'i.</summary>
    Task NotifyJobCreatedAsync(Job job, IReadOnlyCollection<Guid> departmentIds, CancellationToken cancellationToken = default);

    /// <summary>Mesai dışı görev atanınca personel SMS'i (yönetici kümesindeyse atlanır).</summary>
    Task NotifyTaskAssignedAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        CancellationToken cancellationToken = default);
}
