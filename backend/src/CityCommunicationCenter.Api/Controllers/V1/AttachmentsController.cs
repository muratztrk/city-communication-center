using CityCommunicationCenter.Application.Features.Attachments;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/attachments")]
[TenantRequired]
public sealed class AttachmentsController : ApiControllerBase
{
    private readonly IMediator _sender;
    private readonly IApplicationDbContext _dbContext;
    private readonly string _uploadRootPath;

    public AttachmentsController(IMediator sender, IApplicationDbContext dbContext, IOptions<AttachmentStorageOptions> options)
    {
        _sender = sender;
        _dbContext = dbContext;
        _uploadRootPath = options.Value.UploadRootPath;
    }

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

    [HttpGet("{attachmentId:guid}/download")]
    public async Task<IActionResult> Download(Guid attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await _dbContext.Attachments.FindAsync([attachmentId], cancellationToken);
        if (attachment is null || attachment.TenantId != CurrentContext.RequireTenantId()) return NotFound();

        var path = Path.Combine(_uploadRootPath, attachment.TenantId.ToString(), attachment.EntityType, attachment.EntityId.ToString(), attachment.StoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound();

        return File(System.IO.File.OpenRead(path), attachment.ContentType, attachment.FileName, enableRangeProcessing: true);
    }
}
