using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using CityCommunicationCenter.Application.Abstractions.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Infrastructure.Security;

internal sealed class RecaptchaVerificationService : IRecaptchaVerificationService
{
    private const string SiteVerifyEndpoint = "https://www.google.com/recaptcha/api/siteverify";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly RecaptchaOptions _options;
    private readonly ILogger<RecaptchaVerificationService> _logger;

    public RecaptchaVerificationService(
        IHttpClientFactory httpClientFactory,
        IOptions<RecaptchaOptions> options,
        ILogger<RecaptchaVerificationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.SiteKey)
        && !string.IsNullOrWhiteSpace(_options.SecretKey);

    public string? SiteKey => string.IsNullOrWhiteSpace(_options.SiteKey) ? null : _options.SiteKey.Trim();

    public bool IsRequired(bool isTrustedNetwork) => IsConfigured && !isTrustedNetwork;

    public async Task<bool> VerifyAsync(string token, IPAddress? clientIp, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            return false;
        }

        var payload = new List<KeyValuePair<string, string>>
        {
            new("secret", _options.SecretKey.Trim()),
            new("response", token.Trim()),
        };

        if (clientIp is not null)
        {
            payload.Add(new KeyValuePair<string, string>("remoteip", clientIp.ToString()));
        }

        try
        {
            var client = _httpClientFactory.CreateClient(nameof(RecaptchaVerificationService));
            using var response = await client.PostAsync(SiteVerifyEndpoint, new FormUrlEncodedContent(payload), cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("reCAPTCHA siteverify returned HTTP {StatusCode}", response.StatusCode);
                return false;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var verification = await JsonSerializer.DeserializeAsync<RecaptchaSiteVerifyResponse>(
                stream,
                cancellationToken: cancellationToken);

            if (verification?.Success == true)
            {
                return true;
            }

            if (verification?.ErrorCodes is { Count: > 0 })
            {
                _logger.LogWarning("reCAPTCHA verification failed: {ErrorCodes}", string.Join(", ", verification.ErrorCodes));
            }

            return false;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "reCAPTCHA verification request failed");
            return false;
        }
    }

    private sealed class RecaptchaSiteVerifyResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("error-codes")]
        public List<string>? ErrorCodes { get; set; }
    }
}
