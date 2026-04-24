using CityCommunicationCenter.Api.Filters;
using CityCommunicationCenter.Application.Features.Social;
using System.Security.Cryptography;
using System.Text;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/social/webhooks")]
[TenantRequired]
public sealed class SocialWebhooksController : ApiControllerBase
{
    private const string WebhookSecretHeader = "X-CCC-Webhook-Secret";
    private readonly ISender _sender;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public SocialWebhooksController(ISender sender, IConfiguration configuration, IWebHostEnvironment environment)
    {
        _sender = sender;
        _configuration = configuration;
        _environment = environment;
    }

    [HttpPost("{channel}")]
    [AllowAnonymous]
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
            new ReceiveSocialWebhookCommand(channel, CurrentContext.UserId, request),
            cancellationToken);
        return Accepted(new { messageId });
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
}
