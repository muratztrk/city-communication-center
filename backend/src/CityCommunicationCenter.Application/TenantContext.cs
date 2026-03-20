namespace CityCommunicationCenter.Application;

public sealed record TenantContext(
    Guid? TenantId,
    Guid? UserId,
    string? UserDisplayName,
    string? RoleCode,
    bool IsAuthenticated,
    string? ResolutionSource,
    string? ErrorMessage,
    bool ApplyQueryFilter = false);
