namespace CityCommunicationCenter.Shared.Contracts;

// Request DTOs
public sealed record CreateProjectRequest(
    string Title,
    string Description,
    string ProjectType,
    Guid OwnerDepartmentId,
    List<CreateProjectStageRequest> Stages,
    List<Guid>? DepartmentIds);

public sealed record CreateProjectStageRequest(
    string Title,
    string Description,
    int DisplayOrder,
    Guid? ResponsibleDepartmentId);

public sealed record UpdateProjectStatusRequest(string Status);

public sealed record ApproveProjectRequest(string? Comment);

public sealed record ApproveDepartmentJoinRequest(string? Comment);

public sealed record AddProjectMemberRequest(Guid UserId, Guid DepartmentId);

public sealed record UpdateStageStatusRequest(string Status);

// Response DTOs
public sealed record ProjectSummaryResponse(
    Guid ProjectId,
    Guid TenantId,
    string Title,
    string Description,
    string ProjectType,
    string Status,
    Guid OwnerDepartmentId,
    string? OwnerDepartmentName,
    bool RequiresApproval,
    bool IsApproved,
    int StageCount,
    int DepartmentCount,
    int MemberCount,
    DateTimeOffset CreatedAtUtc,
    string? CreatedByUserName);

public sealed record ProjectStageResponse(
    Guid StageId,
    string Title,
    string Description,
    int DisplayOrder,
    string Status,
    Guid? ResponsibleDepartmentId,
    string? ResponsibleDepartmentName);

public sealed record ProjectDepartmentResponse(
    Guid ProjectDepartmentId,
    Guid DepartmentId,
    string DepartmentName,
    string ApprovalStatus,
    Guid? ApprovedByUserId,
    string? ApprovedByUserName,
    DateTimeOffset? ApprovalDateUtc);

public sealed record ProjectMemberResponse(
    Guid ProjectMemberId,
    Guid UserId,
    string UserDisplayName,
    Guid DepartmentId,
    string DepartmentName);

public sealed record ProjectDetailResponse(
    Guid ProjectId,
    Guid TenantId,
    string Title,
    string Description,
    string ProjectType,
    string Status,
    Guid OwnerDepartmentId,
    string? OwnerDepartmentName,
    bool RequiresApproval,
    bool IsApproved,
    Guid? ApprovedByUserId,
    DateTimeOffset? ApprovedAtUtc,
    DateTimeOffset CreatedAtUtc,
    Guid? CreatedByUserId,
    string? CreatedByUserName,
    IReadOnlyCollection<ProjectStageResponse> Stages,
    IReadOnlyCollection<ProjectDepartmentResponse> Departments,
    IReadOnlyCollection<ProjectMemberResponse> Members);
