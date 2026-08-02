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

/// <summary>
/// <see cref="Unspecified"/> = henüz seçilmedi (FE placeholder "SMS sağlayıcısı seçiniz").
/// </summary>
public enum SmsProvider { NetGSM, Iletimerkezi, Verimor, Custom, Asistel, JettMesaj, Infobip, Unspecified }

/// <param name="LiveSendEnabled">
/// Gerçek gönderim anahtarı. Kapalıyken otomatik vatandaş SMS'leri sağlayıcıya GÖNDERİLMEZ;
/// yalnız "şu numaraya şu metin gidecekti" diye loglanır (simülasyon). Şablon/alıcı/zamanlama
/// doğrulaması için. Ayarlar'daki "Test SMS Gönder" bilinçli tekil bir yönetici aksiyonu
/// olduğu için bu anahtardan etkilenmez ve her zaman gerçekten gönderir.
/// </param>
public sealed record TenantSmsSettingsDescriptor(
    bool IsEnabled,
    bool LiveSendEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    bool HasPassword,
    string? Originator,
    string? ChargedNumber);

public sealed record TenantSmsSettingsUpdate(
    bool IsEnabled,
    bool LiveSendEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    string? Password,
    bool ClearPassword,
    string? Originator,
    string? ChargedNumber);

public sealed record TenantSmsCredentials(
    bool IsEnabled,
    bool LiveSendEnabled,
    SmsProvider Provider,
    string? ApiUrl,
    string? Username,
    string? Password,
    string? Originator,
    string? ChargedNumber);
