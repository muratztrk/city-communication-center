using CityCommunicationCenter.Application.Features.Attachments;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/attachments")]
[TenantRequired]
public sealed class AttachmentsController : ApiControllerBase
{
    private readonly IMediator _sender;

    public AttachmentsController(IMediator sender) { _sender = sender; }

    [HttpPost("jobs/{jobId:guid}")]
    [RequestSizeLimit(6_000_000)]
    public async Task<ActionResult<AttachmentResponse>> UploadJobAttachment(
        Guid jobId, IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null) return BadRequest("Dosya bulunamadi.");
        var command = new UploadAttachmentCommand(
            "Job", jobId, CurrentContext.UserId,
            file.FileName, file.ContentType, file.Length, file.OpenReadStream());
        var result = await _sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPost("tasks/{taskId:guid}")]
    [RequestSizeLimit(6_000_000)]
    public async Task<ActionResult<AttachmentResponse>> UploadTaskAttachment(
        Guid taskId, IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null) return BadRequest("Dosya bulunamadi.");
        var command = new UploadAttachmentCommand(
            "Task", taskId, CurrentContext.UserId,
            file.FileName, file.ContentType, file.Length, file.OpenReadStream());
        var result = await _sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpDelete("{attachmentId:guid}")]
    public async Task<IActionResult> Delete(Guid attachmentId, CancellationToken cancellationToken)
    {
        var ok = await _sender.Send(new DeleteAttachmentCommand(attachmentId, CurrentContext.UserId), cancellationToken);
        return ok ? NoContent() : NotFound();
    }
}
