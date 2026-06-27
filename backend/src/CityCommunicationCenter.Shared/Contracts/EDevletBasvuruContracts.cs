namespace CityCommunicationCenter.Shared.Contracts;

public sealed record EDevletBasvuruSummaryResponse(
    Guid BasvuruId,
    string TakipNo,
    string CitizenFirstName,
    string CitizenLastName,
    string BasvuruTipi,
    string Description,
    string? MahalleAdi,
    string? SokakCaddeAdi,
    string Status,
    DateTimeOffset CreatedAtUtc,
    Guid? JobId,
    string? JobDisplayNumber);

public sealed record EDevletBasvuruDetailResponse(
    Guid BasvuruId,
    string TakipNo,
    string CitizenTcKimlikNo,
    string CitizenFirstName,
    string CitizenLastName,
    string BasvuruTipi,
    string Description,
    string? Email,
    IReadOnlyList<string> PhoneNumbers,
    string? IlceAdi,
    string? MahalleAdi,
    string? SokakCaddeAdi,
    string? DisKapiNo,
    string? IcKapiNo,
    string? OpenAddress,
    double? Latitude,
    double? Longitude,
    string? CevapSekli,
    string Status,
    DateTimeOffset CreatedAtUtc,
    Guid? JobId,
    IReadOnlyList<EDevletBasvuruAttachmentResponse> Attachments);

public sealed record EDevletBasvuruAttachmentResponse(
    Guid AttachmentId,
    string DosyaCesidi,
    string OriginalFileName,
    string ContentType,
    long SizeBytes);

public sealed record ConvertEDevletBasvuruToJobRequest(
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    string Priority,
    IReadOnlyCollection<Guid>? TargetDepartmentIds,
    string? CitizenName,
    string? CitizenPhone,
    DateTimeOffset? DueDateUtc,
    string? Neighborhood,
    string? Street,
    string? OpenAddress);
