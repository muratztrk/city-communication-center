namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CreateDepartmentRequest(
    string Name,
    string DepartmentType,
    Guid? ParentDepartmentId,
    Guid? ManagerUserId,
    Guid? DeputyManagerUserId,
    IReadOnlyCollection<Guid>? ResponsibleUserIds,
    string? SourceType = null);

public sealed record UpdateDepartmentRequest(
    string Name,
    string DepartmentType,
    Guid? ManagerUserId,
    Guid? DeputyManagerUserId,
    IReadOnlyCollection<Guid>? ResponsibleUserIds);

public sealed record DepartmentResponse(
    Guid DepartmentId,
    Guid TenantId,
    string Name,
    string DepartmentType,
    Guid? ParentDepartmentId,
    Guid? ManagerUserId,
    Guid? DeputyManagerUserId,
    IReadOnlyCollection<Guid> ResponsibleUserIds,
    string SourceType = "Manual");
