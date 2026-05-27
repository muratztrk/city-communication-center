namespace CityCommunicationCenter.Domain.Entities;

public sealed class Attachment : AuditableTenantEntity
{
    public Guid AttachmentId { get; set; }
    public string EntityType { get; set; } = string.Empty; // "Job" | "Task"
    public Guid EntityId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string StoredFileName { get; set; } = string.Empty; // {attachmentId}{ext}
    public string RelativeUrl { get; set; } = string.Empty;    // /uploads/...
}
