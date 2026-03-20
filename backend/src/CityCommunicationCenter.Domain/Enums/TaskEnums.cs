namespace CityCommunicationCenter.Domain.Enums;

public enum TaskType
{
    CitizenRequest,
    InternalRequest,
    ApprovalTask
}

public enum SourceType
{
    Manual,
    SocialMessage,
    Integration
}

public enum TaskStatus
{
    Draft,
    PendingApproval,
    Assigned,
    InProgress,
    Completed,
    Closed,
    Rejected
}

public enum ApprovalDecision
{
    Pending,
    Approved,
    Rejected,
    Returned
}
