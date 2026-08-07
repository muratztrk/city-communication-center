namespace CityCommunicationCenter.Api.Hubs;

internal static class SignalRGroupNames
{
    public static string User(Guid userId) => $"user-{userId:D}".ToLowerInvariant();

    public static string User(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
        {
            return string.Empty;
        }

        return $"user-{userId.Trim().ToLowerInvariant()}";
    }

    public static string Tenant(Guid tenantId) => $"tenant-{tenantId:D}".ToLowerInvariant();

    public static string Tenant(string tenantId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            return string.Empty;
        }

        return $"tenant-{tenantId.Trim().ToLowerInvariant()}";
    }
}
