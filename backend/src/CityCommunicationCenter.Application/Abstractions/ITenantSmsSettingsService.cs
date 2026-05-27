namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantSmsSettingsService
{
    Task<TenantSmsSettingsDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task SaveSettingsAsync(Guid tenantId, TenantSmsSettingsUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default);
}

public enum SmsProvider { NetGSM, Iletimerkezi, Verimor, Custom }

public sealed record TenantSmsSettingsDescriptor(
    bool IsEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    bool HasPassword,
    string? Originator);

public sealed record TenantSmsSettingsUpdate(
    bool IsEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    string? Password,
    bool ClearPassword,
    string? Originator);
