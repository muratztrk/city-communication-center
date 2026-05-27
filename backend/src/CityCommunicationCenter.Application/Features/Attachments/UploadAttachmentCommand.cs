using Microsoft.Extensions.Options;

namespace CityCommunicationCenter.Application.Features.Attachments;

public sealed class AttachmentStorageOptions
{
    public string UploadRootPath { get; set; } = string.Empty;
}

public sealed record UploadAttachmentCommand(
    string EntityType,
    Guid EntityId,
    Guid? ActorUserId,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    Stream FileStream) : ICommand<AttachmentResponse>;

public sealed class UploadAttachmentCommandHandler : ICommandHandler<UploadAttachmentCommand, AttachmentResponse>
{
    private static readonly HashSet<string> AllowedContentTypes =
    [
        "image/jpeg", "image/png", "image/gif", "image/webp"
    ];

    private static readonly HashSet<string> AllowedExtensions =
    [
        ".jpg", ".jpeg", ".png", ".gif", ".webp"
    ];

    private const long MaxFileSizeBytes = 5 * 1024 * 1024;

    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly string _uploadRootPath;

    public UploadAttachmentCommandHandler(
        IApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        IOptions<AttachmentStorageOptions> options)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _uploadRootPath = options.Value.UploadRootPath;
    }

    public async ValueTask<AttachmentResponse> Handle(UploadAttachmentCommand request, CancellationToken cancellationToken)
    {
        var ext = Path.GetExtension(request.FileName).ToLowerInvariant();

        if (!AllowedExtensions.Contains(ext) || !AllowedContentTypes.Contains(request.ContentType.ToLowerInvariant()))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.FileName),
                    "Sadece JPG, PNG, GIF ve WebP dosyalari yuklenebilir.")
            ]);
        }

        if (request.FileSizeBytes > MaxFileSizeBytes)
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.FileSizeBytes),
                    "Dosya boyutu 5 MB'i asamaz.")
            ]);
        }

        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();

        var attachmentId = Guid.NewGuid();
        var storedFileName = $"{attachmentId}{ext}";
        var entityType = request.EntityType;
        var entityId = request.EntityId;

        var directory = Path.Combine(_uploadRootPath, tenantId.ToString(), entityType, entityId.ToString());
        Directory.CreateDirectory(directory);

        var physicalPath = Path.Combine(directory, storedFileName);
        await using (var fs = File.Create(physicalPath))
        {
            await request.FileStream.CopyToAsync(fs, cancellationToken);
        }

        var relativeUrl = $"/uploads/{tenantId}/{entityType}/{entityId}/{storedFileName}";

        var attachment = new Attachment
        {
            AttachmentId = attachmentId,
            TenantId = tenantId,
            EntityType = entityType,
            EntityId = entityId,
            FileName = request.FileName,
            ContentType = request.ContentType,
            FileSizeBytes = request.FileSizeBytes,
            StoredFileName = storedFileName,
            RelativeUrl = relativeUrl,
            CreatedByUserId = request.ActorUserId,
        };

        _dbContext.Attachments.Add(attachment);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new AttachmentResponse(
            attachment.AttachmentId,
            attachment.FileName,
            attachment.ContentType,
            attachment.FileSizeBytes,
            attachment.RelativeUrl,
            attachment.CreatedAtUtc);
    }
}
