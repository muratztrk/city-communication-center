namespace CityCommunicationCenter.Application.Abstractions;

public interface IWhatsAppJobNotifier
{
    Task NotifyCitizenRequestStatusChangedAsync(
        Guid tenantId,
        Guid jobId,
        string statusLabel,
        Guid? actorUserId,
        CancellationToken ct = default);

    Task NotifyJobActivatedAsync(Guid tenantId, Guid jobId, CancellationToken ct = default);

    Task NotifyJobCompletedAsync(Guid tenantId, Guid jobId, CancellationToken ct = default);

    Task NotifyJobCancelledAsync(Guid tenantId, Guid jobId, string? reason, CancellationToken ct = default);
}
