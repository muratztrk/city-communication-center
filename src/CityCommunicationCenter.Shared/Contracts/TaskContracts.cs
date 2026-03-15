namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CreateTaskRequest(
    string Title,
    string Description,
    string TaskType,
    string SourceType,
    Guid? SourceRefId,
    Guid? TargetDepartmentId,
    string Priority,
    DateTimeOffset? DueDateUtc);

public sealed record SubmitTaskRequest(string? Note);

public sealed record ApprovalActionRequest(string? Comment);

public sealed record AssignTaskRequest(
    Guid? DepartmentId,
    Guid? UserId,
    string ActionType);

public sealed record CompleteTaskRequest(string? ResultNote);

public sealed record CloseTaskRequest(string? ClosureNote);

public sealed record TaskSummaryResponse(
    Guid TaskId,
    Guid TenantId,
    string Title,
    string TaskType,
    string Priority,
    string CurrentStatus,
    Guid? TargetDepartmentId,
    Guid? AssignedUserId,
    DateTimeOffset? DueDateUtc);

public sealed record ApprovalStepResponse(
    Guid ApprovalId,
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
    string Title,
    string Description,
    string TaskType,
    string SourceType,
    string Priority,
    string CurrentStatus,
    Guid? SourceRefId,
    Guid? TargetDepartmentId,
    Guid? AssignedDepartmentId,
    Guid? AssignedUserId,
    DateTimeOffset? DueDateUtc,
    IReadOnlyCollection<ApprovalStepResponse> Approvals,
    IReadOnlyCollection<AssignmentHistoryResponse> AssignmentHistory);
