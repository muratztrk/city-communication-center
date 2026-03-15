namespace CityCommunicationCenter.Infrastructure.Options;

public sealed class TenantResolutionOptions
{
    public const string SectionName = "TenantResolution";

    public string HeaderName { get; set; } = "X-Tenant-Id";
}
