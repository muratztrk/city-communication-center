using System.Net.Http;
using CityCommunicationCenter.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// jeTTMesaj GET METHOD API v1.02.
/// <c>http://api.jettmesaj.com/?username=..&amp;password=..&amp;sender=..&amp;receipents=..&amp;content=..</c>
/// Yanıt gövdesi <c>OK</c> ise başarılı, aksi halde EK-A hata kodu.
/// NOT: parametre adı dokümanda <c>receipents</c> (yazım hatası sağlayıcıya ait) — düzeltilmemeli.
/// </summary>
internal sealed class JettMesajSmsSender : ISmsProviderSender
{
    private const string DefaultEndpoint = "http://api.jettmesaj.com/";
    private const int MaxContentLength = 612;

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<JettMesajSmsSender> _logger;

    public JettMesajSmsSender(IHttpClientFactory httpClientFactory, ILogger<JettMesajSmsSender> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public SmsProvider Provider => SmsProvider.JettMesaj;

    public async Task<SmsSendResult> SendAsync(
        TenantSmsCredentials credentials,
        string normalizedPhone,
        string text,
        CancellationToken cancellationToken)
    {
        if (text.Length > MaxContentLength)
        {
            _logger.LogWarning(
                "jeTTMesaj SMS metni {Length} karakter; sağlayıcı sınırı {Limit}. Sağlayıcı reddedebilir.",
                text.Length,
                MaxContentLength);
        }

        // ApiUrl yalnız sağlayıcının bilinen host'una işaret edebilir — aksi halde kayıtlı parola
        // saldırganın sunucusuna gider (bkz. SmsEndpointAllowList).
        var baseUrl = SmsEndpointAllowList.Resolve(SmsProvider.JettMesaj, credentials.ApiUrl, DefaultEndpoint);
        var query = string.Join('&', new[]
        {
            $"username={Uri.EscapeDataString(credentials.Username ?? string.Empty)}",
            $"password={Uri.EscapeDataString(credentials.Password ?? string.Empty)}",
            $"sender={Uri.EscapeDataString(credentials.Originator ?? string.Empty)}",
            $"receipents={Uri.EscapeDataString(normalizedPhone)}",
            $"content={Uri.EscapeDataString(text)}",
        });

        var separator = baseUrl.Contains('?', StringComparison.Ordinal) ? '&' : '?';
        var requestUri = $"{baseUrl}{separator}{query}";
        var client = _httpClientFactory.CreateClient(SmsHttpClient.Name);

        using var response = await client.GetAsync(requestUri, cancellationToken);
        var body = (await response.Content.ReadAsStringAsync(cancellationToken)).Trim();

        if (!response.IsSuccessStatusCode)
        {
            // Gövde sağlayıcıdan gelen güvenilmeyen içerik; loga/koda ham haliyle taşınmaz.
            _logger.LogWarning(
                "jeTTMesaj HTTP {Status}: {Body}",
                (int)response.StatusCode,
                body.Length <= 200 ? body : body[..200] + "…");
            return SmsSendResult.Fail($"jeTTMesaj HTTP {(int)response.StatusCode} döndürdü.");
        }

        // Gövde bazen "OK" bazen "OK <transactionId>" biçiminde gelir; ilk token'a bakılır.
        var code = body.Split([' ', '\r', '\n', '\t'], StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? body;

        return SmsProviderErrorCodes.IsSuccess(code)
            ? SmsSendResult.Ok(code, SmsProviderErrorCodes.Describe(code))
            : SmsSendResult.Fail(SmsProviderErrorCodes.Describe(code), code);
    }
}
