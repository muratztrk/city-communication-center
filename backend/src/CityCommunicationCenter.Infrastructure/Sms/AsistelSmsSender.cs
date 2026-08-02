using System.Net.Http;
using System.Text;
using System.Xml.Linq;
using CityCommunicationCenter.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// Asistel (Avea AsistSMS) WEB SERVİS API v1.59 — SOAP 1.1 <c>SmsGonder</c> metodu.
/// Endpoint: <c>http://92.42.35.50:16899/smswebservice.asmx</c>
/// </summary>
internal sealed class AsistelSmsSender : ISmsProviderSender
{
    private const string DefaultEndpoint = "http://92.42.35.50:16899/smswebservice.asmx";
    private const string SoapAction = "http://tempuri.org/SmsGonder";
    private static readonly XNamespace Soap = "http://schemas.xmlsoap.org/soap/envelope/";
    private static readonly XNamespace Tempuri = "http://tempuri.org/";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<AsistelSmsSender> _logger;

    public AsistelSmsSender(IHttpClientFactory httpClientFactory, ILogger<AsistelSmsSender> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public SmsProvider Provider => SmsProvider.Asistel;

    public async Task<SmsSendResult> SendAsync(
        TenantSmsCredentials credentials,
        string normalizedPhone,
        string text,
        CancellationToken cancellationToken)
    {
        // ApiUrl yalnız sağlayıcının bilinen host'una işaret edebilir (bkz. SmsEndpointAllowList).
        var endpoint = SmsEndpointAllowList.Resolve(SmsProvider.Asistel, credentials.ApiUrl, DefaultEndpoint);

        // Boş gonderimTarihi Asistel'de 108 ("Tarih formatı yanlış") döndürüyor (#6a6efc64).
        // Anlık gönderim için Europe/Istanbul saati ddMMyyyyHHmmss verilmeli.
        var envelope = new XDocument(
            new XElement(Soap + "Envelope",
                new XAttribute(XNamespace.Xmlns + "soap", Soap.NamespaceName),
                new XElement(Soap + "Body",
                    new XElement(Tempuri + "SmsGonder",
                        new XElement(Tempuri + "kullaniciAd", credentials.Username ?? string.Empty),
                        new XElement(Tempuri + "parola", credentials.Password ?? string.Empty),
                        new XElement(Tempuri + "gsmNo",
                            new XElement(Tempuri + "string", normalizedPhone)),
                        new XElement(Tempuri + "smsText",
                            new XElement(Tempuri + "string", text)),
                        new XElement(Tempuri + "gonderimTarihi", FormatImmediateSendAt()),
                        new XElement(Tempuri + "alfaNumeric", credentials.Originator ?? string.Empty),
                        new XElement(Tempuri + "chargedNumber", credentials.ChargedNumber ?? string.Empty),
                        // Tek metin tek/çok numaraya → false (her numaraya ayrı metin için true).
                        new XElement(Tempuri + "multiSms", "false")))));

        using var content = new StringContent(
            envelope.Declaration + envelope.ToString(SaveOptions.DisableFormatting),
            Encoding.UTF8,
            "text/xml");
        content.Headers.ContentType!.CharSet = "utf-8";

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint) { Content = content };
        request.Headers.Add("SOAPAction", $"\"{SoapAction}\"");

        var client = _httpClientFactory.CreateClient(SmsHttpClient.Name);
        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Asistel SOAP HTTP {Status}: {Body}", (int)response.StatusCode, Truncate(body));
            return SmsSendResult.Fail($"Asistel HTTP {(int)response.StatusCode} döndürdü.");
        }

        var code = ExtractResult(body);
        if (code is null)
        {
            _logger.LogWarning("Asistel yanıtı çözümlenemedi: {Body}", Truncate(body));
            return SmsSendResult.Fail("Asistel yanıtı çözümlenemedi.");
        }

        if (SmsProviderErrorCodes.IsSuccess(code))
        {
            return SmsSendResult.Ok(code, SmsProviderErrorCodes.Describe(code));
        }

        if (SmsProviderErrorCodes.IsKnownErrorCode(code))
        {
            return SmsSendResult.Fail(SmsProviderErrorCodes.Describe(code), code);
        }

        // Başarılı gönderimde servis TransactionId döndürebiliyor (EK-D bu id ile rapor sorgulatıyor).
        // Hata kodları 3 hane (100-122); yalnız 4+ haneli sayısal yanıt transactionId sayılır ki
        // dokümante edilmemiş 3 haneli bir hata kodu yanlışlıkla "gönderildi" olarak işaretlenmesin.
        if (code.Length >= 4 && long.TryParse(code, out _))
        {
            return SmsSendResult.Ok(code, "SMS başarıyla gönderildi.");
        }

        _logger.LogWarning("Asistel beklenmeyen yanıt kodu: {Code}", Truncate(code));
        return SmsSendResult.Fail(SmsProviderErrorCodes.Describe(code), code);
    }

    private static string? ExtractResult(string body)
    {
        try
        {
            return XDocument.Parse(body)
                .Descendants(Tempuri + "SmsGonderResult")
                .FirstOrDefault()
                ?.Value
                ?.Trim();
        }
        catch (System.Xml.XmlException)
        {
            return null;
        }
    }

    /// <summary>Asistel EK-A: gonderimTarihi = ddMMyyyyHHmmss (Türkiye saati).</summary>
    internal static string FormatImmediateSendAt(DateTimeOffset? utcNow = null)
    {
        var utc = (utcNow ?? DateTimeOffset.UtcNow).UtcDateTime;
        var tz = ResolveTurkeyTimeZone();
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, tz);
        return local.ToString("ddMMyyyyHHmmss");
    }

    private static TimeZoneInfo ResolveTurkeyTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time");
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time");
        }
    }

    private static string Truncate(string value) =>
        value.Length <= 500 ? value : value[..500] + "…";
}
