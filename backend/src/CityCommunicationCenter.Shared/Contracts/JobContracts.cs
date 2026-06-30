namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CreateJobRequest(
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    IReadOnlyCollection<Guid>? OwnerUserIds,
    string Priority,
    string? RequestType,
    bool IsProject,
    string? CitizenName,
    string? CitizenPhone,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    IReadOnlyCollection<Guid>? TargetDepartmentIds,
    string? SourceType,
    Guid? SourceRefId,
    double? Latitude,
    double? Longitude,
    string? Neighborhood = null,
    string? Street = null,
    string? OpenAddress = null);

public sealed record UpdateJobRequest(
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    double? Latitude,
    double? Longitude,
    bool? IsProject = null,
    string? Neighborhood = null,
    string? Street = null,
    string? OpenAddress = null,
    IReadOnlyCollection<Guid>? TargetDepartmentIds = null,
    string? CitizenName = null,
    string? CitizenPhone = null);

public sealed record CancelJobRequest(string Reason);

public sealed record JobApprovalDecisionRequest(string? Comment, bool? ConfirmedIsProject = null);

public sealed record RejectJobRequest(string Reason);

public sealed record AddCoordinatingDepartmentsRequest(IReadOnlyCollection<Guid> DepartmentIds);

public sealed record SetJobManagerNoteRequest(string? Note);

public sealed record JobDepartmentResponse(
    Guid JobDepartmentId,
    Guid DepartmentId,
    string? DepartmentName,
    string Role,
    string ApprovalStatus,
    Guid? RequestedByUserId,
    Guid? ApprovedByUserId,
    string? ApprovedByDisplayName,
    DateTimeOffset? RequestedAtUtc,
    DateTimeOffset? DecidedAtUtc,
    string? RejectReason,
    string? Notes);

public sealed record JobSummaryResponse(
    Guid JobId,
    Guid TenantId,
    string Title,
    string Status,
    string Priority,
    string RequestType,
    bool IsProject,
    bool IsProjectCreatorRequested,
    bool IsProjectOwnerConfirmed,
    string? CitizenName,
    string? CitizenPhone,
    Guid OwnerDepartmentId,
    string? OwnerDepartmentName,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    int? CompletionPercentage,
    bool IsCoordinated,
    string SourceType,
    int TaskCount,
    IReadOnlyCollection<JobDepartmentResponse> Departments,
    DateTimeOffset CreatedAtUtc,
    int? JobNumber,
    int? JobNumberYear,
    string? CreatedByDisplayName,
    DateTimeOffset? UpdatedAtUtc,
    string? AssignedUserDisplayName = null,
    string? CreatedByRoleCode = null,
    // Vatandaş talebi (citizen) için linkli sosyal mesajın VT numarası — gridlerde VT- gösterimi (card #1077).
    int? CitizenRequestNumber = null,
    int? CitizenRequestNumberYear = null);

public sealed record JobDetailResponse(
    Guid JobId,
    Guid TenantId,
    string Title,
    string Description,
    string Status,
    string Priority,
    string RequestType,
    bool IsProject,
    bool IsProjectCreatorRequested,
    bool IsProjectOwnerConfirmed,
    string? CitizenName,
    string? CitizenPhone,
    Guid OwnerDepartmentId,
    string? OwnerDepartmentName,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    int? CompletionPercentage,
    bool IsCoordinated,
    string SourceType,
    Guid? SourceRefId,
    string? CancelReason,
    double? Latitude,
    double? Longitude,
    string? Neighborhood,
    string? Street,
    string? OpenAddress,
    string? CreatedByDisplayName,
    DateTimeOffset CreatedAtUtc,
    int? JobNumber,
    int? JobNumberYear,
    string? ManagerNote,
    IReadOnlyCollection<JobDepartmentResponse> Departments,
    IReadOnlyCollection<TaskSummaryResponse> Tasks,
    IReadOnlyCollection<ApprovalStepResponse> Approvals,
    IReadOnlyCollection<AttachmentResponse> Attachments,
    // Durumu belirleyen kullanıcı: iptal eden / tamamlayan görevi yapan / onay bekleyen yönetici (card 643).
    string? StatusActorDisplayName = null,
    // Tamamlanan talebin görevindeki tamamlama notu (card 643).
    string? CompletionNote = null,
    // Talebin son güncellenme zamanı — "Talep Detayları"nda iptal tarihi olarak kullanılır (card #715).
    DateTimeOffset? UpdatedAtUtc = null);
