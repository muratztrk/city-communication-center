using CityCommunicationCenter.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Sms;

internal interface ISmsProviderSender
{
    SmsProvider Provider { get; }

    Task<SmsSendResult> SendAsync(
        TenantSmsCredentials credentials,
        string normalizedPhone,
        string text,
        CancellationToken cancellationToken);
}

internal static class SmsHttpClient
{
    public const string Name = "sms-gateway";
}

internal sealed class SmsGateway : ISmsGateway
{
    private readonly ITenantSmsSettingsService _settingsService;
    private readonly IReadOnlyDictionary<SmsProvider, ISmsProviderSender> _senders;
    private readonly ILogger<SmsGateway> _logger;

    public SmsGateway(
        ITenantSmsSettingsService settingsService,
        IEnumerable<ISmsProviderSender> senders,
        ILogger<SmsGateway> logger)
    {
        _settingsService = settingsService;
        _senders = senders.ToDictionary(sender => sender.Provider);
        _logger = logger;
    }

    public Task<SmsSendResult> SendAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        CancellationToken cancellationToken = default)
        => SendInternalAsync(tenantId, phoneNumber, text, requireEnabled: true, cancellationToken);

    /// <summary>
    /// Test gönderimi "SMS Gönderimi Aktif" ve "Gerçek Gönderim" kapalıyken de GERÇEKTEN
    /// gönderir: yönetici ayarları canlıya almadan önce kullanıcı adı/parola/başlık üçlüsünü
    /// doğrulayabilsin. Tekil ve bilinçli bir aksiyon olduğu için simülasyon dışında tutuldu.
    /// </summary>
    public Task<SmsSendResult> SendTestAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        CancellationToken cancellationToken = default)
        => SendInternalAsync(tenantId, phoneNumber, text, requireEnabled: false, cancellationToken);

    private async Task<SmsSendResult> SendInternalAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        bool requireEnabled,
        CancellationToken cancellationToken)
    {
        var credentials = await _settingsService.GetCredentialsAsync(tenantId, cancellationToken);

        if (requireEnabled && !credentials.IsEnabled)
        {
            return SmsSendResult.Fail("SMS gönderimi Ayarlar'da kapalı.");
        }

        if (!_senders.TryGetValue(credentials.Provider, out var sender))
        {
            return SmsSendResult.Fail(
                $"'{credentials.Provider}' sağlayıcısı için gönderim entegrasyonu yok. "
                + "Ayarlar > SMS API'den Asistel veya jeTTMesaj seçin.");
        }

        if (string.IsNullOrWhiteSpace(credentials.Username) || string.IsNullOrWhiteSpace(credentials.Password))
        {
            return SmsSendResult.Fail("SMS kullanıcı adı veya parolası tanımlı değil.");
        }

        if (string.IsNullOrWhiteSpace(credentials.Originator))
        {
            // Başlık boş gidince sağlayıcı 109 döner; hatayı ağa çıkmadan anlaşılır ver.
            return SmsSendResult.Fail("SMS Gönderici Adı (başlık) tanımlı değil.");
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            return SmsSendResult.Fail("SMS metni boş.");
        }

        var normalizedPhone = SmsPhoneNumber.TryNormalize(phoneNumber);
        if (normalizedPhone is null)
        {
            return SmsSendResult.Fail($"Telefon numarası 90XXXXXXXXXX formatına çevrilemedi: '{phoneNumber}'.");
        }

        try
        {
            var result = await sender.SendAsync(credentials, normalizedPhone, text, cancellationToken);
            if (!result.Success)
            {
                _logger.LogWarning(
                    "SMS gönderimi başarısız ({Provider}, {Phone}): {Message} [{Code}]",
                    credentials.Provider,
                    MaskPhone(normalizedPhone),
                    result.Message,
                    result.ProviderCode);
            }

            return result;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            // Vatandaş bildirimi, sağlayıcı erişilemediği için iş akışını patlatmamalı.
            // İstisna metni ÇAĞIRANA DÖNMEZ: jeTTMesaj parolayı URL'de taşıyor ve HttpClient
            // istisnaları isteğin URI'sini mesaja koyabiliyor — detay yalnız loga gider.
            _logger.LogError(
                exception,
                "SMS gönderiminde beklenmeyen hata ({Provider}, {Phone})",
                credentials.Provider,
                MaskPhone(normalizedPhone));
            return SmsSendResult.Fail("SMS sağlayıcısına ulaşılamadı. Ayrıntı için sunucu loglarına bakın.");
        }
    }

    private static string MaskPhone(string phone) =>
        phone.Length <= 4 ? "****" : string.Concat(phone.AsSpan(0, phone.Length - 4), "****");
}
