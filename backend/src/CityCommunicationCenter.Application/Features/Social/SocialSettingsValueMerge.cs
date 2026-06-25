namespace CityCommunicationCenter.Application.Features.Social;

internal static class SocialSettingsValueMerge
{
    public static string? UseIncomingOrExisting(string? incoming, string? existing) =>
        string.IsNullOrWhiteSpace(incoming) ? existing : incoming.Trim();
}
