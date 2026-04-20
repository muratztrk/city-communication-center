namespace CityCommunicationCenter.Domain.Enums;

public enum JobStatus
{
    Draft,
    PendingOwnerApproval,
    PendingExternalApproval,
    Active,
    Completed,
    Rejected,
    Cancelled
}

public enum JobDepartmentRole
{
    Owner,
    Target,
    Support,
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
