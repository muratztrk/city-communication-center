using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Application.Features.Social;
using System.Security.Cryptography;
using System.Text;

namespace CityCommunicationCenter.Api.Controllers.V1;

[ApiController]
[Route("api/v1/social/webhooks")]
[AllowAnonymous]
public sealed class SocialWebhooksController : ControllerBase
{
    private const string WebhookSecretHeader = "X-CCC-Webhook-Secret";
    private const string MetaSignatureHeader = "X-Hub-Signature-256";
    private readonly IMediator _sender;
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private readonly Microsoft.Extensions.Logging.ILogger<SocialWebhooksController> _logger;

    public SocialWebhooksController(
        IMediator sender,
        ISocialMediaSettingsProvider settingsProvider,
        IConfiguration configuration,
        IWebHostEnvironment environment,
        Microsoft.Extensions.Logging.ILogger<SocialWebhooksController> logger)
    {
        _sender = sender;
        _settingsProvider = settingsProvider;
        _configuration = configuration;
        _environment = environment;
        _logger = logger;
    }

    [HttpPost("{channel}")]
    [TenantRequired]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> Receive(
        string channel,
        [FromBody] SocialWebhookRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsWebhookAuthorized())
        {
            return _environment.IsDevelopment()
                ? Unauthorized(new { error = "Webhook secret is missing or invalid." })
                : NotFound();
        }

        var messageId = await _sender.Send(
            new ReceiveSocialWebhookCommand(channel, null, request),
            cancellationToken);
        return Accepted(new { messageId });
    }

    [HttpGet("whatsapp/{tenantId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public IActionResult VerifyWhatsApp(
        Guid tenantId,
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge)
    {
        var settings = _settingsProvider.GetSettings(tenantId)?.WhatsApp;
        if (!string.Equals(mode, "subscribe", StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(challenge) ||
            !SecretsMatch(settings?.WebhookVerifyToken, verifyToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden);
        }

        return Content(challenge, "text/plain", Encoding.UTF8);
    }

    [HttpPost("whatsapp/{tenantId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ReceiveWhatsApp(Guid tenantId, CancellationToken cancellationToken)
    {
        var correlationId = string.IsNullOrWhiteSpace(HttpContext.TraceIdentifier)
            ? Guid.NewGuid().ToString("N")
            : HttpContext.TraceIdentifier;
        Response.Headers["X-Correlation-Id"] = correlationId;

        var settings = _settingsProvider.GetSettings(tenantId)?.WhatsApp;
        if (string.IsNullOrWhiteSpace(settings?.AppSecret) ||
            string.IsNullOrWhiteSpace(settings.PhoneNumberId))
        {
            LogRejected(correlationId, WhatsAppWebhookSkipReason.MissingWhatsAppSettings);
            return NotFound();
        }

        await using var bodyBuffer = new MemoryStream();
        await Request.Body.CopyToAsync(bodyBuffer, cancellationToken);
        var body = bodyBuffer.ToArray();

        if (!IsMetaSignatureValid(settings.AppSecret, body))
        {
            LogRejected(correlationId, WhatsAppWebhookSkipReason.InvalidSignature);
            return Unauthorized();
        }

        JsonDocument payload;
        try
        {
            payload = JsonDocument.Parse(body);
        }
        catch (JsonException)
        {
            LogRejected(correlationId, WhatsAppWebhookSkipReason.InvalidJson);
            return BadRequest();
        }

        using (payload)
        {
            if (!IsWhatsAppPayloadForPhoneNumber(payload.RootElement, settings.PhoneNumberId))
            {
                LogPhoneNumberMismatch(correlationId, settings.PhoneNumberId, payload.RootElement);
                return BadRequest();
            }

            var receivedCount = await _sender.Send(
                new ReceiveWhatsAppWebhookCommand(
                    tenantId,
                    payload.RootElement.Clone(),
                    correlationId,
                    settings.PhoneNumberId),
                cancellationToken);

            return Ok(new { receivedCount });
        }
    }

    private void LogRejected(string correlationId, string skipReason)
    {
        _logger.LogWarning(
            "WhatsApp webhook processed. CorrelationId={CorrelationId} Result={Result} SkipReason={SkipReason}",
            correlationId,
            WhatsAppWebhookProcessingResult.Failed,
            skipReason);
    }

    private void LogPhoneNumberMismatch(string correlationId, string expectedPhoneNumberId, JsonElement payload)
    {
        var hints = WhatsAppWebhookForensics.Enumerate(payload);
        if (hints.Count == 0)
        {
            _logger.LogInformation(
                "WhatsApp webhook processed. CorrelationId={CorrelationId} ExpectedPhoneNumberId={ExpectedPhoneNumberId} Result={Result} SkipReason={SkipReason}",
                correlationId,
                expectedPhoneNumberId,
                WhatsAppWebhookProcessingResult.PhoneNumberMismatch,
                WhatsAppWebhookSkipReason.PhoneNumberMismatch);
            return;
        }

        foreach (var hint in hints)
        {
            _logger.LogInformation(
                "WhatsApp webhook processed. CorrelationId={CorrelationId} WabaId={WabaId} PhoneNumberId={PhoneNumberId} ExpectedPhoneNumberId={ExpectedPhoneNumberId} MessageId={MessageId} Sender={Sender} EventType={EventType} MessageType={MessageType} Result={Result} SkipReason={SkipReason}",
                correlationId,
                hint.WabaId,
                hint.PhoneNumberId,
                expectedPhoneNumberId,
                hint.MessageId,
                hint.SenderMasked,
                hint.EventType,
                hint.MessageType,
                WhatsAppWebhookProcessingResult.PhoneNumberMismatch,
                WhatsAppWebhookSkipReason.PhoneNumberMismatch);
        }
    }

    private bool IsWebhookAuthorized()
    {
        var configuredSecret = _configuration["SocialWebhooks:SharedSecret"];
        if (string.IsNullOrWhiteSpace(configuredSecret))
        {
            return false;
        }

        var providedSecret = Request.Headers[WebhookSecretHeader].ToString();
        if (string.IsNullOrWhiteSpace(providedSecret))
        {
            return false;
        }

        var configuredBytes = Encoding.UTF8.GetBytes(configuredSecret);
        var providedBytes = Encoding.UTF8.GetBytes(providedSecret);

        return configuredBytes.Length == providedBytes.Length
            && CryptographicOperations.FixedTimeEquals(configuredBytes, providedBytes);
    }

    private bool IsMetaSignatureValid(string appSecret, byte[] body)
    {
        var signature = Request.Headers[MetaSignatureHeader].ToString();
        if (!signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        byte[] providedHash;
        try
        {
            providedHash = Convert.FromHexString(signature["sha256=".Length..]);
        }
        catch (FormatException)
        {
            return false;
        }

        var expectedHash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(appSecret), body);
        return providedHash.Length == expectedHash.Length
            && CryptographicOperations.FixedTimeEquals(providedHash, expectedHash);
    }

    private static bool IsWhatsAppPayloadForPhoneNumber(JsonElement payload, string phoneNumberId)
    {
        if (!payload.TryGetProperty("object", out var objectType) ||
            !string.Equals(objectType.GetString(), "whatsapp_business_account", StringComparison.Ordinal))
        {
            return false;
        }

        if (!payload.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array)
        {
            return false;
        }

        foreach (var entry in entries.EnumerateArray())
        {
            if (!entry.TryGetProperty("changes", out var changes) || changes.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var change in changes.EnumerateArray())
            {
                if (change.TryGetProperty("value", out var value) &&
                    value.TryGetProperty("metadata", out var metadata) &&
                    metadata.TryGetProperty("phone_number_id", out var payloadPhoneNumberId) &&
                    string.Equals(payloadPhoneNumberId.GetString(), phoneNumberId, StringComparison.Ordinal))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool SecretsMatch(string? expected, string? provided)
    {
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(provided))
        {
            return false;
        }

        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        var providedBytes = Encoding.UTF8.GetBytes(provided);
        return expectedBytes.Length == providedBytes.Length
            && CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }
}
