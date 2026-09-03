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
    private readonly ISmsOutboundLogWriter _outboundLogWriter;
    private readonly ILogger<SmsGateway> _logger;

    public SmsGateway(
        ITenantSmsSettingsService settingsService,
        IEnumerable<ISmsProviderSender> senders,
        ISmsOutboundLogWriter outboundLogWriter,
        ILogger<SmsGateway> logger)
    {
        _settingsService = settingsService;
        _senders = senders.ToDictionary(sender => sender.Provider);
        _outboundLogWriter = outboundLogWriter;
        _logger = logger;
    }

    public Task<SmsSendResult> SendAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        SmsSendContext? context = null,
        CancellationToken cancellationToken = default)
        => SendInternalAsync(tenantId, phoneNumber, text, requireEnabled: true, context, cancellationToken);

    public Task<SmsSendResult> SendTestAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        SmsSendContext? context = null,
        CancellationToken cancellationToken = default)
    {
        var testContext = context ?? new SmsSendContext(Domain.Enums.SmsOutboundKind.Test);
        if (testContext.Kind == Domain.Enums.SmsOutboundKind.Unknown)
        {
            testContext = testContext with { Kind = Domain.Enums.SmsOutboundKind.Test };
        }

        return SendInternalAsync(tenantId, phoneNumber, text, requireEnabled: false, testContext, cancellationToken);
    }

    private async Task<SmsSendResult> SendInternalAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        bool requireEnabled,
        SmsSendContext? context,
        CancellationToken cancellationToken)
    {
        var credentials = await _settingsService.GetCredentialsAsync(tenantId, cancellationToken);
        var sendContext = context ?? new SmsSendContext(Domain.Enums.SmsOutboundKind.Unknown);

        if (requireEnabled && !credentials.IsEnabled)
        {
            return await FailAndLogAsync(
                tenantId,
                phoneNumber,
                text,
                credentials.Provider,
                sendContext,
                SmsSendResult.Fail("SMS gönderimi Ayarlar'da kapalı."),
                cancellationToken);
        }

        if (credentials.Provider == SmsProvider.Unspecified)
        {
            return await FailAndLogAsync(
                tenantId,
                phoneNumber,
                text,
                credentials.Provider,
                sendContext,
                SmsSendResult.Fail("SMS sağlayıcısı seçilmedi. Ayarlar > SMS API'den seçin."),
                cancellationToken);
        }

        if (!_senders.TryGetValue(credentials.Provider, out var sender))
        {
            return await FailAndLogAsync(
                tenantId,
                phoneNumber,
                text,
                credentials.Provider,
                sendContext,
                SmsSendResult.Fail(
                    $"'{credentials.Provider}' sağlayıcısı için gönderim entegrasyonu yok. "
                    + "Ayarlar > SMS API'den Asistel veya jeTTMesaj seçin."),
                cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(credentials.Username) || string.IsNullOrWhiteSpace(credentials.Password))
        {
            return await FailAndLogAsync(
                tenantId,
                phoneNumber,
                text,
                credentials.Provider,
                sendContext,
                SmsSendResult.Fail("SMS kullanıcı adı veya parolası tanımlı değil."),
                cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(credentials.Originator))
        {
            return await FailAndLogAsync(
                tenantId,
                phoneNumber,
                text,
                credentials.Provider,
                sendContext,
                SmsSendResult.Fail("SMS Gönderici Adı (başlık) tanımlı değil."),
                cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            return await FailAndLogAsync(
                tenantId,
                phoneNumber,
                text,
                credentials.Provider,
                sendContext,
                SmsSendResult.Fail("SMS metni boş."),
                cancellationToken);
        }

        var outboundText = text.Trim();

        var normalizedPhone = SmsPhoneNumber.TryNormalize(phoneNumber);
        if (normalizedPhone is null)
        {
            return await FailAndLogAsync(
                tenantId,
                phoneNumber,
                outboundText,
                credentials.Provider,
                sendContext,
                SmsSendResult.Fail($"Telefon numarası 90XXXXXXXXXX formatına çevrilemedi: '{phoneNumber}'."),
                cancellationToken);
        }

        try
        {
            var result = await sender.SendAsync(credentials, normalizedPhone, outboundText, cancellationToken);
            if (!result.Success)
            {
                _logger.LogWarning(
                    "SMS gönderimi başarısız ({Provider}, {Phone}): {Message} [{Code}]",
                    credentials.Provider,
                    MaskPhone(normalizedPhone),
                    result.Message,
                    result.ProviderCode);
            }

            await WriteLogAsync(
                tenantId,
                normalizedPhone,
                outboundText,
                credentials.Provider,
                sendContext,
                result,
                cancellationToken);
            return result;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception exception)
        {
            _logger.LogError(
                exception,
                "SMS gönderiminde beklenmeyen hata ({Provider}, {Phone})",
                credentials.Provider,
                MaskPhone(normalizedPhone));
            var result = SmsSendResult.Fail("SMS sağlayıcısına ulaşılamadı. Ayrıntı için sunucu loglarına bakın.");
            await WriteLogAsync(
                tenantId,
                normalizedPhone,
                outboundText,
                credentials.Provider,
                sendContext,
                result,
                cancellationToken);
            return result;
        }
    }

    private async Task<SmsSendResult> FailAndLogAsync(
        Guid tenantId,
        string phoneNumber,
        string text,
        SmsProvider provider,
        SmsSendContext context,
        SmsSendResult result,
        CancellationToken cancellationToken)
    {
        var maskedPhone = MaskPhone(SmsPhoneNumber.TryNormalize(phoneNumber) ?? phoneNumber);
        await WriteLogAsync(tenantId, maskedPhone, text, provider, context, result, cancellationToken);
        return result;
    }

    private Task WriteLogAsync(
        Guid tenantId,
        string phoneForMasking,
        string text,
        SmsProvider provider,
        SmsSendContext context,
        SmsSendResult result,
        CancellationToken cancellationToken)
    {
        var entry = new SmsOutboundLogEntry(
            tenantId,
            context,
            MaskPhone(phoneForMasking),
            text,
            result.Success,
            provider.ToString(),
            result.ProviderCode,
            result.Message);
        return _outboundLogWriter.WriteAsync(entry, cancellationToken);
    }

    internal static string MaskPhone(string phone) =>
        phone.Length <= 4 ? "****" : string.Concat(phone.AsSpan(0, phone.Length - 4), "****");
}
