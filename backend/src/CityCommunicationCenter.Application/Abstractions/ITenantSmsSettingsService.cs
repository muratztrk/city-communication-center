namespace CityCommunicationCenter.Application.Abstractions;

public interface ITenantSmsSettingsService
{
    Task<TenantSmsSettingsDescriptor> GetSettingsAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task SaveSettingsAsync(Guid tenantId, TenantSmsSettingsUpdate settings, Guid? actorUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Parola dahil gönderim kimlik bilgileri. YALNIZ SMS gönderen servis kullanır; API
    /// yanıtlarında asla dönmez (<see cref="TenantSmsSettingsDescriptor"/> sadece HasPassword taşır).
    /// </summary>
    Task<TenantSmsCredentials> GetCredentialsAsync(Guid tenantId, CancellationToken cancellationToken = default);
}

public enum SmsProvider { NetGSM, Iletimerkezi, Verimor, Custom, Asistel, JettMesaj }

public sealed record TenantSmsSettingsDescriptor(
    bool IsEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    bool HasPassword,
    string? Originator,
    string? ChargedNumber);

public sealed record TenantSmsSettingsUpdate(
    bool IsEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    string? Password,
    bool ClearPassword,
    string? Originator,
    string? ChargedNumber);

public sealed record TenantSmsCredentials(
    bool IsEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    string? Password,
    string? Originator,
    string? ChargedNumber);
