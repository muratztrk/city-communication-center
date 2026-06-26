using System.Net.Http.Headers;
using CityCommunicationCenter.Application.Features.Social;
using CityCommunicationCenter.Application.Features;
using CityCommunicationCenter.Application.Abstractions.SocialMedia;
using CityCommunicationCenter.Domain.Enums;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/social/messages")]
[TenantRequired]
public sealed class SocialMessagesController : ApiControllerBase
{
    private readonly IMediator _sender;
    private readonly ISocialMediaSettingsProvider _settingsProvider;
    private readonly IHttpClientFactory _httpClientFactory;

    public SocialMessagesController(
        IMediator sender,
        ISocialMediaSettingsProvider settingsProvider,
        IHttpClientFactory httpClientFactory)
    {
        _sender = sender;
        _settingsProvider = settingsProvider;
        _httpClientFactory = httpClientFactory;
    }

    [HttpGet("")]
    [ProducesResponseType<IEnumerable<SocialMessageSummaryResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IEnumerable<SocialMessageSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSocialMessagesQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreateSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        var channel = Enum.TryParse<SocialChannel>(request.Channel, ignoreCase: true, out var parsed)
            ? parsed
            : SocialChannel.Other;

        var messageId = await _sender.Send(
            new CreateSocialMessageCommand(
                CurrentContext.UserId ?? Guid.Empty,
                channel,
                request.CitizenHandle,
                request.Content,
                request.Category,
                request.Latitude,
                request.Longitude),
            cancellationToken);

        return CreatedAtAction(nameof(GetById), new { messageId }, new { socialMessageId = messageId });
    }

    [HttpPut("{messageId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid messageId,
        [FromBody] UpdateSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        var channel = Enum.TryParse<SocialChannel>(request.Channel, ignoreCase: true, out var parsed)
            ? parsed
            : SocialChannel.Other;

        var updated = await _sender.Send(
            new UpdateSocialMessageCommand(
                messageId,
                CurrentContext.UserId,
                channel,
                request.CitizenHandle,
                request.Content,
                request.Category,
                request.Latitude,
                request.Longitude),
            cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpGet("{messageId:guid}")]
    [ProducesResponseType<SocialMessageDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SocialMessageDetailResponse>> GetById(Guid messageId, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetSocialMessageByIdQuery(messageId), cancellationToken);
        if (response is null) return NotFound();
        return Ok(response);
    }

    [HttpPost("{messageId:guid}/categorize")]
    public async Task<IActionResult> Categorize(
        Guid messageId,
        [FromBody] CategorizeSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(
            new CategorizeSocialMessageCommand(messageId, CurrentContext.UserId, request.Category, request.Tags),
            cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{messageId:guid}/route")]
    public async Task<IActionResult> Route(
        Guid messageId,
        [FromBody] RouteSocialMessageRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _sender.Send(
            new RouteSocialMessageCommand(messageId, CurrentContext.UserId, request.DepartmentId, request.UserId),
            cancellationToken);
        if (!updated) return NotFound();
        return NoContent();
    }

    [HttpPost("{messageId:guid}/convert")]
    [HttpPost("{messageId:guid}/convert-to-job")]
    public async Task<ActionResult<JobSummaryResponse>> ConvertToJob(
        Guid messageId,
        [FromBody] ConvertSocialMessageToJobRequest request,
        CancellationToken cancellationToken)
    {
        var job = await _sender.Send(
            new ConvertSocialMessageToJobCommand(
                messageId,
                CurrentContext.UserId,
                request.Title,
                request.Description,
                request.OwnerDepartmentId,
                request.Priority,
                request.DueDateUtc,
                request.RequestType,
                request.TargetDepartmentIds,
                request.IsProject,
                request.StartDateUtc,
                request.Neighborhood,
                request.Street,
                request.OpenAddress,
                request.CitizenName,
                request.CitizenPhone),
            cancellationToken);
        if (job is null) return NotFound();

        return CreatedAtAction(
            nameof(JobsController.GetById),
            "Jobs",
            new { jobId = job.JobId },
            job);
    }

    [HttpDelete("{messageId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid messageId, CancellationToken cancellationToken)
    {
        var deleted = await _sender.Send(
            new DeleteSocialMessageCommand(messageId, CurrentContext.TenantId!.Value),
            cancellationToken);
        if (!deleted) return NotFound();
        return NoContent();
    }

    [HttpGet("{messageId:guid}/conversation")]
    [ProducesResponseType<IReadOnlyList<SocialConversationEntryDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SocialConversationEntryDto>>> GetConversation(
        Guid messageId,
        CancellationToken cancellationToken)
    {
        var entries = await _sender.Send(new GetSocialConversationQuery(messageId), cancellationToken);
        return Ok(entries);
    }

    [HttpPost("{messageId:guid}/reply")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reply(
        Guid messageId,
        [FromBody] SocialReplyRequest request,
        CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(
            new ReplyToSocialMessageCommand(messageId, CurrentContext.UserId, request.Content),
            cancellationToken);
        if (!ok) return NotFound();
        return NoContent();
    }

    /// <summary>Proxies WhatsApp media (image/video/audio/document) through the server.</summary>
    [HttpGet("{messageId:guid}/conversation/media/{entryId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMedia(
        Guid messageId,
        Guid entryId,
        CancellationToken cancellationToken)
    {
        var tenantId = CurrentContext.TenantId ?? Guid.Empty;
        if (tenantId == Guid.Empty)
            return Unauthorized();
        var settings = _settingsProvider.GetSettings(tenantId)?.WhatsApp;
        if (string.IsNullOrWhiteSpace(settings?.AccessToken))
            return NotFound();

        var entry = await _sender.Send(new GetSocialConversationQuery(messageId), cancellationToken);
        var target = entry.FirstOrDefault(e => e.EntryId == entryId);
        if (target is null || string.IsNullOrWhiteSpace(target.MediaId))
            return NotFound();

        var httpClient = _httpClientFactory.CreateClient("WhatsAppMedia");
        httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", settings.AccessToken);

        // Step 1: Get download URL from Graph API
        var metaResp = await httpClient.GetAsync(
            $"https://graph.facebook.com/v25.0/{target.MediaId}",
            cancellationToken);

        if (!metaResp.IsSuccessStatusCode) return NotFound();

        var metaJson = await metaResp.Content.ReadAsStringAsync(cancellationToken);
        using var doc = System.Text.Json.JsonDocument.Parse(metaJson);
        var downloadUrl = doc.RootElement.TryGetProperty("url", out var urlProp) ? urlProp.GetString() : null;
        if (string.IsNullOrWhiteSpace(downloadUrl)) return NotFound();

        // Step 2: Download and stream
        var fileResp = await httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!fileResp.IsSuccessStatusCode) return NotFound();

        var contentType = target.MediaMimeType ?? fileResp.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
        var stream = await fileResp.Content.ReadAsStreamAsync(cancellationToken);
        return File(stream, contentType);
    }
}
