using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Domain.Entities;
using CityCommunicationCenter.Domain.Enums;
using CityCommunicationCenter.Infrastructure.Persistence;
using CityCommunicationCenter.Shared.Contracts;
using Microsoft.AspNetCore.Mvc;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/social/webhooks")]
public sealed class SocialWebhooksController : ApiControllerBase
{
    private readonly CityCommunicationCenterDbContext _dbContext;

    public SocialWebhooksController(
        CityCommunicationCenterDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor)
        : base(tenantContextAccessor)
    {
        _dbContext = dbContext;
    }

    [HttpPost("{channel}")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> Receive(
        string channel,
        [FromBody] SocialWebhookRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryGetTenantId(out var tenantId, out var error))
        {
            return error;
        }

        var message = new SocialMessage
        {
            SocialMessageId = Guid.NewGuid(),
            TenantId = tenantId.Value,
            Channel = Enum.TryParse<SocialChannel>(channel, true, out var parsedChannel)
                ? parsedChannel
                : SocialChannel.Other,
            ExternalMessageId = request.ExternalMessageId,
            CitizenHandle = request.CitizenHandle,
            Content = request.Content,
            ReceivedAtUtc = request.ReceivedAtUtc ?? DateTimeOffset.UtcNow,
            CreatedByUserId = CurrentContext.UserId
        };

        await _dbContext.InsertSocialMessageAsync(message, cancellationToken);
        return Accepted(new { messageId = message.SocialMessageId });
    }
}
