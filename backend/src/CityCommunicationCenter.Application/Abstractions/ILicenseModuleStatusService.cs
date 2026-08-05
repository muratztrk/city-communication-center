namespace CityCommunicationCenter.Application.Abstractions;

public sealed record ResolvedLicenseModuleStatus(
    LicenseModule Module,
    bool Usable,
    string Status,
    DateTimeOffset? ValidUntil,
    string? Message,
    DateTimeOffset? ExpiresAt,
    string BundleId,
    bool HasStoredToken,
    string Source);

public interface ILicenseModuleStatusService
{
    Task<ResolvedLicenseModuleStatus> GetModuleStatusAsync(
        Guid tenantId,
        string tenantSlug,
        LicenseModule module,
        CancellationToken cancellationToken = default);

    Task SaveStoredTokenAsync(
        Guid tenantId,
        LicenseModule module,
        string tenantSlug,
        string token,
        CancellationToken cancellationToken = default);
}
