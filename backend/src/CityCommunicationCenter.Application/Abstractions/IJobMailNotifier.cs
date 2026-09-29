using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Abstractions;

public interface IJobMailNotifier
{
    Task NotifyIncomingAsync(
        Job job,
        IReadOnlyCollection<Guid> departmentIds,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task NotifyTaskAssignedAsync(
        Job job,
        Guid assigneeUserId,
        Guid? assignedDepartmentId,
        Guid? actorUserId = null,
        CancellationToken cancellationToken = default);

    Task ProcessOverdueMailsAsync(CancellationToken cancellationToken = default);
}
