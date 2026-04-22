namespace CityCommunicationCenter.Shared.Contracts;

public sealed record CreateDepartmentRequest(
    string Name,
    string DepartmentType,
    Guid? ParentDepartmentId,
    Guid? ManagerUserId);

public sealed record UpdateDepartmentRequest(
    string Name,
    string DepartmentType,
    Guid? ManagerUserId);

public sealed record DepartmentResponse(
    Guid DepartmentId,
    Guid TenantId,
    string Name,
    string DepartmentType,
    Guid? ParentDepartmentId,
    Guid? ManagerUserId);
