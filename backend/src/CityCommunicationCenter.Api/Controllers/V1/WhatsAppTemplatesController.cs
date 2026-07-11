using CityCommunicationCenter.Application.Features.Social;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/whatsapp-templates")]
[TenantRequired]
public sealed class WhatsAppTemplatesController : ApiControllerBase
{
    private readonly IMediator _sender;

    public WhatsAppTemplatesController(IMediator sender)
    {
        _sender = sender;
    }

    [HttpGet("")]
    [ProducesResponseType<IReadOnlyList<WhatsAppMessageTemplateDto>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<WhatsAppMessageTemplateDto>>> GetAll(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetWhatsAppTemplatesQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpPost("sync-from-meta")]
    [ProducesResponseType<WhatsAppTemplatesSyncFromMetaResult>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<WhatsAppTemplatesSyncFromMetaResult>> SyncFromMeta(CancellationToken cancellationToken)
    {
        var result = await _sender.Send(
            new SyncWhatsAppTemplatesFromMetaCommand(CurrentContext.UserId ?? Guid.Empty),
            cancellationToken);
        return Ok(result);
    }

    [HttpPost("")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] WhatsAppMessageTemplateRequest request,
        CancellationToken cancellationToken)
    {
        var id = await _sender.Send(
            new SaveWhatsAppTemplateCommand(null, CurrentContext.UserId ?? Guid.Empty, request),
            cancellationToken);

        return CreatedAtAction(nameof(GetAll), new { }, new { templateId = id });
    }

    [HttpPut("{templateId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid templateId,
        [FromBody] WhatsAppMessageTemplateRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await _sender.Send(
                new SaveWhatsAppTemplateCommand(templateId, CurrentContext.UserId ?? Guid.Empty, request),
                cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("{templateId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid templateId, CancellationToken cancellationToken)
    {
        var deleted = await _sender.Send(new DeleteWhatsAppTemplateCommand(templateId), cancellationToken);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
