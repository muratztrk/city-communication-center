namespace CityCommunicationCenter.Shared.Contracts;

public sealed record AttachmentResponse(
    Guid AttachmentId,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    string Url,
    DateTimeOffset UploadedAtUtc);
