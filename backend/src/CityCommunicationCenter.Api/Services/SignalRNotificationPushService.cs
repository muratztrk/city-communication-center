using CityCommunicationCenter.Api.Hubs;
using CityCommunicationCenter.Application.Abstractions;
using Microsoft.AspNetCore.SignalR;

namespace CityCommunicationCenter.Api.Services;

public sealed class SignalRNotificationPushService : INotificationPushService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<SignalRNotificationPushService> _logger;

    public SignalRNotificationPushService(
        IHubContext<NotificationHub> hubContext,
        ILogger<SignalRNotificationPushService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task SendToUserAsync(Guid tenantId, Guid userId, NotificationPayload payload, CancellationToken cancellationToken = default)
    {
        _logger.LogDebug("Sending notification to user {UserId} in tenant {TenantId}: {Title}",
            userId, tenantId, payload.Title);

        await _hubContext.Clients
            .Group($"user-{userId}")
            .SendAsync("ReceiveNotification", payload, cancellationToken);
    }

    public async Task SendToTenantAsync(Guid tenantId, NotificationPayload payload, CancellationToken cancellationToken = default)
    {
        _logger.LogDebug("Sending notification to tenant {TenantId}: {Title}",
            tenantId, payload.Title);

        await _hubContext.Clients
            .Group($"tenant-{tenantId}")
            .SendAsync("ReceiveNotification", payload, cancellationToken);
    }
}
