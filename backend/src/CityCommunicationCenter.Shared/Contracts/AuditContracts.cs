namespace CityCommunicationCenter.Shared.Contracts;

public sealed record EntityAuditLogEntryResponse(
    Guid AuditLogId,
    string Action,
    string ActorDisplayName,
    string? DepartmentName,
    string? StatusAtEvent,
    string? Notes,
    DateTimeOffset EventTimeUtc);
