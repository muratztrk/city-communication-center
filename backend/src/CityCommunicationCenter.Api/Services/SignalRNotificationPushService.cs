using CityCommunicationCenter.Api.Hubs;
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

    public async Task SendWhatsAppMessageToTenantAsync(
        Guid tenantId,
        WhatsAppMessagePayload payload,
        CancellationToken cancellationToken = default)
    {
        _logger.LogDebug(
            "Sending WhatsApp message update to tenant {TenantId} for conversation {ConversationId}",
            tenantId,
            payload.CitizenConversationId);

        await _hubContext.Clients
            .Group($"tenant-{tenantId}")
            .SendAsync("ReceiveWhatsAppMessage", payload, cancellationToken);
    }

    public async Task SendInternalMessageToUserAsync(
        Guid tenantId,
        Guid recipientUserId,
        InternalMessagePayload payload,
        CancellationToken cancellationToken = default)
    {
        _logger.LogDebug(
            "Sending internal message to user {UserId} in tenant {TenantId} for conversation {ConversationId}",
            recipientUserId,
            tenantId,
            payload.InternalConversationId);

        await _hubContext.Clients
            .Group($"user-{recipientUserId}")
            .SendAsync("ReceiveInternalMessage", payload, cancellationToken);
    }
}
