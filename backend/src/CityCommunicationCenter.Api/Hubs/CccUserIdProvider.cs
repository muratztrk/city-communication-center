using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;

namespace CityCommunicationCenter.Api.Hubs;

internal sealed class CccUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        var userId = connection.User?.FindFirst("sub")?.Value
            ?? connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return string.IsNullOrWhiteSpace(userId) ? null : userId.Trim().ToLowerInvariant();
    }
}
