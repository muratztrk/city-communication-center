namespace CityCommunicationCenter.Domain.Entities;

public sealed class EDevletBasvuruAttachment : AuditableTenantEntity
{
    public Guid AttachmentId { get; set; }

    public Guid BasvuruId { get; set; }

    public string DosyaCesidi { get; set; } = string.Empty;

    public string DosyaUzanti { get; set; } = string.Empty;

    public string? BelgeTarihi { get; set; }

    public string? BelgeSayisi { get; set; }

    public string StoredFileName { get; set; } = string.Empty;

    public string OriginalFileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = "application/octet-stream";

    public long SizeBytes { get; set; }

    public EDevletBasvuru Basvuru { get; set; } = null!;
}
