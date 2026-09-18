namespace CityCommunicationCenter.Application.Abstractions;

/// <summary>Geciken vatandaş talepleri için yönetici/sorumlu/VTY SMS bildirimi.</summary>
public interface IOverdueJobSmsNotifier
{
    Task ProcessOverdueJobsAsync(CancellationToken cancellationToken = default);
}
