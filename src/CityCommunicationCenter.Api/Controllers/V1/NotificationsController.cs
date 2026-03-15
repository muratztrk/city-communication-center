using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/notifications")]
public sealed class NotificationsController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public NotificationsController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    [ProducesResponseType<IEnumerable<NotificationResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<NotificationResponse>>> GetAll(CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var notifications = await _dbContext.Notifications
            .WhereTenant(tenantId.Value)
            .ToListAsync(cancellationToken);

        var response = notifications
            .OrderByDescending(x => x.SentAtUtc)
            .Select(x => new NotificationResponse(
                x.NotificationId,
                x.TaskId,
                x.UserId,
                x.Channel.ToString(),
                x.DeliveryStatus.ToString(),
                x.Message,
                x.SentAtUtc))
            .ToList();

        return Ok(response);
    }

    [HttpPost("test")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> SendTest(
        [FromBody] TestNotificationRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            UserId = CurrentContext.UserId ?? Guid.Empty,
            Channel = Enum.Parse<NotificationChannel>(request.Channel, true),
            DeliveryStatus = NotificationDeliveryStatus.Pending,
            Message = request.Message,
            CreatedByUserId = CurrentContext.UserId
        };

        await _dbContext.InsertNotificationAsync(notification, cancellationToken);
        return Accepted(new { notificationId = notification.NotificationId, recipient = request.Recipient });
    }

    [HttpPut("preferences")]
    public IActionResult UpdatePreferences([FromBody] UpdateNotificationPreferencesRequest request)
    {
        return Ok(new
        {
            message = "Notification preferences update contract accepted.",
            request.EmailEnabled,
            request.SmsEnabled,
            request.InAppEnabled
        });
    }
}
