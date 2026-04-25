namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CreateJobRequest(
    string Title,
    string Description,
    Guid OwnerDepartmentId,
    string Priority,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    IReadOnlyCollection<Guid>? TargetDepartmentIds,
    string? SourceType,
    Guid? SourceRefId);

public sealed record AddSupportDepartmentRequest(Guid DepartmentId, string? Notes);

public sealed record CancelJobRequest(string Reason);

public sealed record JobDepartmentResponse(
    Guid JobDepartmentId,
    Guid DepartmentId,
    string? DepartmentName,
    string Role,
    string ApprovalStatus,
    Guid? RequestedByUserId,
    Guid? ApprovedByUserId,
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
    Guid OwnerDepartmentId,
    string? OwnerDepartmentName,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    int? CompletionPercentage,
    bool IsCoordinated,
    string SourceType,
    int TaskCount,
    IReadOnlyCollection<JobDepartmentResponse> Departments);

public sealed record JobDetailResponse(
    Guid JobId,
    Guid TenantId,
    string Title,
    string Description,
    string Status,
    string Priority,
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
    string? CreatedByDisplayName,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyCollection<JobDepartmentResponse> Departments,
    IReadOnlyCollection<TaskSummaryResponse> Tasks,
    IReadOnlyCollection<ApprovalStepResponse> Approvals);
