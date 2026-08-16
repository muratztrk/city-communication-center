namespace CityCommunicationCenter.Infrastructure.Options;

public sealed class GoogleMapsOptions
{
    public const string SectionName = "GoogleMaps";

    public string ApiKey { get; set; } = string.Empty;
}
