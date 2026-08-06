using CityCommunicationCenter.Application;
using CityCommunicationCenter.Application.Abstractions;
using CityCommunicationCenter.Application.Features.Attachments;
using Microsoft.EntityFrameworkCore;

namespace CityCommunicationCenter.Api.Controllers.V1;

[Route("api/v1/attachments")]
[TenantRequired]
public sealed class AttachmentsController : ApiControllerBase
{
    private readonly IMediator _sender;
    private readonly IApplicationDbContext _dbContext;
    private readonly INotificationPushService _notificationPushService;
    private readonly string _uploadRootPath;

    public AttachmentsController(
        IMediator sender,
        IApplicationDbContext dbContext,
        INotificationPushService notificationPushService,
        IOptions<AttachmentStorageOptions> options)
    {
        _sender = sender;
        _dbContext = dbContext;
        _notificationPushService = notificationPushService;
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

    [HttpPost("internal-messages/{messageId:guid}")]
    [RequestSizeLimit(6_000_000)]
    public async Task<ActionResult<AttachmentResponse>> UploadInternalMessageAttachment(
        Guid messageId, IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null) return BadRequest("Dosya bulunamadi.");

        var tenantId = CurrentContext.RequireTenantId();
        var message = await _dbContext.InternalMessages
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.InternalMessageId == messageId && m.TenantId == tenantId, cancellationToken);
        if (message is null) return NotFound();
        if (message.SenderUserId != CurrentContext.UserId) return Forbid();

        var command = new UploadAttachmentCommand(
            "InternalMessage", messageId, CurrentContext.UserId,
            file.FileName, file.ContentType, file.Length, file.OpenReadStream());
        var result = await _sender.Send(command, cancellationToken);

        var conversation = await _dbContext.InternalConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.InternalConversationId == message.InternalConversationId && c.TenantId == tenantId, cancellationToken);
        if (conversation is not null)
        {
            var recipientUserId = message.SenderUserId == conversation.UserAId
                ? conversation.UserBId
                : conversation.UserAId;
            var senderName = await _dbContext.Users.AsNoTracking()
                .Where(u => u.TenantId == tenantId && u.UserId == message.SenderUserId)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;
            try
            {
                await _notificationPushService.SendInternalMessageToUserAsync(
                    tenantId,
                    recipientUserId,
                    new InternalMessagePayload(
                        conversation.InternalConversationId,
                        message.SenderUserId,
                        senderName,
                        file.FileName,
                        DateTimeOffset.UtcNow),
                    cancellationToken);
            }
            catch
            {
                // Ek kaydedildi; alıcı bir sonraki yenilemede görür.
            }
        }

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
        var tenantId = CurrentContext.RequireTenantId();
        var attachment = await _dbContext.Attachments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.AttachmentId == attachmentId && a.TenantId == tenantId, cancellationToken);
        if (attachment is null) return NotFound();

        if (attachment.EntityType == "InternalMessage")
        {
            var message = await _dbContext.InternalMessages.AsNoTracking()
                .FirstOrDefaultAsync(m => m.InternalMessageId == attachment.EntityId && m.TenantId == tenantId, cancellationToken);
            if (message is null) return NotFound();

            var conversation = await _dbContext.InternalConversations.AsNoTracking()
                .FirstOrDefaultAsync(c => c.InternalConversationId == message.InternalConversationId && c.TenantId == tenantId, cancellationToken);
            if (conversation is null) return NotFound();

            var userId = CurrentContext.UserId;
            if (userId != conversation.UserAId && userId != conversation.UserBId) return Forbid();
        }

        var path = Path.Combine(_uploadRootPath, attachment.TenantId.ToString(), attachment.EntityType, attachment.EntityId.ToString(), attachment.StoredFileName);
        if (!System.IO.File.Exists(path)) return NotFound();

        return File(System.IO.File.OpenRead(path), attachment.ContentType, attachment.FileName, enableRangeProcessing: true);
    }
}
