namespace CityCommunicationCenter.Domain.Enums;

public enum JobStatus
{
    Draft,
    PendingOwnerApproval,
    PendingExternalApproval,
    Active,
    Completed,
    Rejected,
    Cancelled,
    RevisionRequested
}

public enum JobRequestType
{
    InternalUnit,
    ExternalUnit,
    Citizen
}

public enum JobDepartmentRole
{
    Owner,
    Target,
    Coordinating
}

public enum JobApprovalStatus
{
    Pending,
    Approved,
    Rejected,
    NotRequired
}

public enum ApprovalSubjectType
{
    Job,
    Task,
    TaskClose,
    TaskRevision
}
