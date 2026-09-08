using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using CityCommunicationCenter.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace CityCommunicationCenter.Infrastructure.Sms;

/// <summary>
/// Teknomart SMS REST API — POST <c>/sms/create</c>, Basic Authentication.
/// Doküman: https://app.teknomart.com.tr/api-docs
/// </summary>
internal sealed class TeknomartSmsSender : ISmsProviderSender
{
    private const string DefaultEndpoint = "https://app.teknomart.com.tr:9588/sms/create";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TeknomartSmsSender> _logger;

    public TeknomartSmsSender(IHttpClientFactory httpClientFactory, ILogger<TeknomartSmsSender> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public SmsProvider Provider => SmsProvider.Teknormart;

    public async Task<SmsSendResult> SendAsync(
        TenantSmsCredentials credentials,
        string normalizedPhone,
        string text,
        CancellationToken cancellationToken)
    {
        var endpoint = SmsEndpointAllowList.Resolve(SmsProvider.Teknormart, credentials.ApiUrl, DefaultEndpoint);
        var payload = new TeknomartCreateSmsRequest
        {
            Type = 1,
            SendingType = 0,
            Title = BuildPackageTitle(),
            Content = text,
            Number = normalizedPhone,
            Encoding = 1,
            Sender = credentials.Originator ?? string.Empty,
            Validity = 1440,
            Commercial = false,
            SkipAhsQuery = true,
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = CreateBasicAuthHeader(credentials.Username, credentials.Password);
        request.Content = JsonContent.Create(payload, options: JsonOptions);

        var client = _httpClientFactory.CreateClient(SmsHttpClient.Name);
        using var response = await client.SendAsync(request, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        TeknomartCreateSmsResponse? parsed = null;
        if (!string.IsNullOrWhiteSpace(body))
        {
            try
            {
                parsed = JsonSerializer.Deserialize<TeknomartCreateSmsResponse>(body, JsonOptions);
            }
            catch (JsonException)
            {
                // Yanıt JSON değilse aşağıda HTTP kodu ile döner.
            }
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Teknomart HTTP {Status}: {Body}",
                (int)response.StatusCode,
                Truncate(body));

            if (parsed?.Err is not null)
            {
                var message = MapTeknomartError(parsed.Err, (int)response.StatusCode);
                var code = parsed.Err.Code ?? parsed.Err.Status?.ToString() ?? ((int)response.StatusCode).ToString();
                return SmsSendResult.Fail(message, code);
            }

            return SmsSendResult.Fail($"Teknomart HTTP {(int)response.StatusCode} döndürdü.");
        }

        if (parsed is null)
        {
            _logger.LogWarning("Teknomart yanıtı çözümlenemedi: {Body}", Truncate(body));
            return SmsSendResult.Fail("Teknomart yanıtı çözümlenemedi.");
        }

        if (parsed.Err is not null)
        {
            var message = MapTeknomartError(parsed.Err, (int)response.StatusCode);
            var code = parsed.Err.Code ?? parsed.Err.Status?.ToString() ?? "ERR";
            return SmsSendResult.Fail(message, code);
        }

        if (parsed.Data?.PkgId is null or <= 0)
        {
            _logger.LogWarning("Teknomart başarı yanıtında pkgID yok: {Body}", Truncate(body));
            return SmsSendResult.Fail("Teknomart yanıtında paket numarası dönmedi.");
        }

        var pkgId = parsed.Data.PkgId.Value.ToString();
        return SmsSendResult.Ok(pkgId, "SMS başarıyla gönderildi.");
    }

    internal static string MapTeknomartError(TeknomartCreateSmsError err, int httpStatus)
    {
        if (string.Equals(err.Code, "ERR_UNAUTHORIZED_REQUEST", StringComparison.OrdinalIgnoreCase)
            || httpStatus is 401 or 403)
        {
            return "Teknomart kullanıcı adı/parola hatalı, IP kısıtı var veya API yetkisi yok.";
        }

        if (!string.IsNullOrWhiteSpace(err.Message)
            && !string.Equals(err.Message, err.Code, StringComparison.OrdinalIgnoreCase))
        {
            return err.Message.Trim();
        }

        return err.Code?.Trim() ?? "Teknomart SMS gönderimi başarısız.";
    }

    internal static AuthenticationHeaderValue CreateBasicAuthHeader(string? username, string? password)
    {
        var token = Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{username ?? string.Empty}:{password ?? string.Empty}"));
        return new AuthenticationHeaderValue("Basic", token);
    }

    internal static string BuildPackageTitle(DateTimeOffset? utcNow = null)
    {
        var stamp = (utcNow ?? DateTimeOffset.UtcNow).ToString("yyyyMMddHHmmss");
        return $"TIC-{stamp}";
    }

    private static string Truncate(string value) =>
        value.Length <= 200 ? value : value[..200] + "…";

    private sealed class TeknomartCreateSmsRequest
    {
        public int Type { get; init; }

        public int SendingType { get; init; }

        public string Title { get; init; } = string.Empty;

        public string Content { get; init; } = string.Empty;

        public string Number { get; init; } = string.Empty;

        public int Encoding { get; init; }

        public string Sender { get; init; } = string.Empty;

        public int Validity { get; init; }

        public bool Commercial { get; init; }

        public bool SkipAhsQuery { get; init; }
    }

    internal sealed class TeknomartCreateSmsResponse
    {
        public TeknomartCreateSmsData? Data { get; init; }

        public TeknomartCreateSmsError? Err { get; init; }
    }

    internal sealed class TeknomartCreateSmsData
    {
        [JsonPropertyName("pkgID")]
        public long? PkgId { get; init; }
    }

    internal sealed class TeknomartCreateSmsError
    {
        public string? Code { get; init; }

        public int? Status { get; init; }

        public string? Message { get; init; }
    }
}
