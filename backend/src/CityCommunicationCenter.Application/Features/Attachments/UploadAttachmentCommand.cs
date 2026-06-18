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
    // Resim (JPG/PNG), PDF ve tüm Office uzantıları (card 539). Office MIME tipleri
    // tarayıcıdan güvenilmez geldiğinden doğrulama uzantı üzerinden yapılır.
    private static readonly HashSet<string> AllowedExtensions =
    [
        ".jpg", ".jpeg", ".png", ".pdf",
        ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"
    ];

    // Yürütülebilir/arşiv/paketleyici gibi tehlikeli uzantılar açıkça reddedilir (card 581).
    // İzin listesi zaten yalnızca güvenli türlere izin verir; bu liste güvenlik için ek savunmadır.
    private static readonly HashSet<string> BlockedExtensions =
    [
        ".net", ".activemime", ".arj", ".aspack", ".bat", ".binhex", ".bzip", ".bzip2",
        ".chm", ".cod", ".dmg", ".elf", ".exe", ".flac", ".fsg", ".hlp", ".hta", ".iso",
        ".jad", ".mach-o", ".msi", ".petite", ".rm", ".sis", ".tar", ".torrent", ".upx",
        ".uue", ".xar", ".xz"
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

        if (BlockedExtensions.Contains(ext))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.FileName),
                    "Guvenlik nedeniyle bu dosya turu yuklenemez.")
            ]);
        }

        if (!AllowedExtensions.Contains(ext))
        {
            throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(request.FileName),
                    "Yalnizca resim (JPG, PNG), PDF ve Office dosyalari yuklenebilir.")
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
