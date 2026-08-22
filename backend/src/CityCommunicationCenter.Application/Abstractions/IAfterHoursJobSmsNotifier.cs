using CityCommunicationCenter.Domain.Entities;

namespace CityCommunicationCenter.Application.Abstractions;

public interface IAfterHoursJobSmsNotifier
{
    Task NotifyAsync(Job job, IReadOnlyCollection<Guid> departmentIds, CancellationToken cancellationToken = default);
}
