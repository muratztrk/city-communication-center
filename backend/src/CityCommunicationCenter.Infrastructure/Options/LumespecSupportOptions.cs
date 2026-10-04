namespace CityCommunicationCenter.Infrastructure.Options;

public sealed class LumespecSupportOptions
{
    public const string SectionName = "LumespecSupport";

    public bool Enabled { get; set; }

    public string BaseUrl { get; set; } = "https://destek.lumespec.com";

    public string ServiceToken { get; set; } = string.Empty;

    public string EnvironmentName { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 10;
}
