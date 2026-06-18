namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CreateRoutineTaskRequest(
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? DueDateUtc,
    string? Notes,
    string? Neighborhood = null,
    string? Street = null,
    string? OpenAddress = null);

public sealed record CreateTaskRequest(
    Guid JobId,
    string Title,
    string Description,
    string Priority,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    decimal? EstimatedHours,
    string? Notes,
    Guid? AssignedDepartmentId,
    Guid? AssignedUserId);

public sealed record AssignTaskRequest(
    Guid? DepartmentId,
    Guid? UserId);

public sealed record CompleteTaskRequest(string? ResultNote, decimal? ActualHours);

public sealed record RequestTaskRevisionRequest(string Reason, DateTimeOffset? ProposedDueDateUtc, Guid? TargetManagerUserId);

public sealed record CancelTaskRequest(string Reason);

public sealed record ApprovalActionRequest(string? Comment);

public sealed record UpdateTaskProgressRequest(int? CompletionPercentage, decimal? ActualHours, string? Notes);

public sealed record TaskSummaryResponse(
    Guid TaskId,
    Guid TenantId,
    Guid JobId,
    string? JobTitle,
    string? JobRequestType,
    string? JobSourceType,
    int? JobNumber,
    int? JobNumberYear,
    string Title,
    string Priority,
    string CurrentStatus,
    Guid? AssignedDepartmentId,
    string? AssignedDepartmentName,
    Guid? AssignedUserId,
    string? AssignedUserDisplayName,
    DateTimeOffset? DueDateUtc,
    int? CompletionPercentage,
    decimal? EstimatedHours,
    decimal? ActualHours,
    string? CreatedByDisplayName,
    DateTimeOffset CreatedAtUtc,
    string? OwnerDisplayName,
    int? TaskNumber,
    int? TaskNumberYear,
    string? OwnerDepartmentName,
    DateTimeOffset? CompletedAtUtc,
    DateTimeOffset? UpdatedAtUtc,
    string? CreatedByRoleCode = null,
    Guid? OwnerUserId = null);

public sealed record ApprovalStepResponse(
    Guid ApprovalId,
    string SubjectType,
    Guid SubjectId,
    Guid ApproverUserId,
    int StepOrder,
    string Decision,
    DateTimeOffset? DecisionDateUtc,
    string? Comment);

public sealed record AssignmentHistoryResponse(
    Guid AssignmentId,
    Guid? FromDepartmentId,
    Guid? ToDepartmentId,
    Guid? FromUserId,
    Guid? ToUserId,
    string ActionType,
    DateTimeOffset ActionDateUtc);

public sealed record TaskDetailResponse(
    Guid TaskId,
    Guid TenantId,
    Guid JobId,
    string? JobTitle,
    string? JobRequestType,
    string? JobSourceType,
    string Title,
    string Description,
    string Priority,
    string CurrentStatus,
    Guid? AssignedDepartmentId,
    Guid? AssignedUserId,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    int? CompletionPercentage,
    decimal? EstimatedHours,
    decimal? ActualHours,
    string? Notes,
    string? RevisionReason,
    string? CreatedByDisplayName,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyCollection<ApprovalStepResponse> Approvals,
    IReadOnlyCollection<AssignmentHistoryResponse> AssignmentHistory,
    string? OwnerDisplayName,
    IReadOnlyCollection<AttachmentResponse> Attachments,
    string? AssigningManagerDisplayName,
    string? AssignedDepartmentName,
    string? AssignedUserDisplayName,
    int? TaskNumber,
    int? TaskNumberYear);
