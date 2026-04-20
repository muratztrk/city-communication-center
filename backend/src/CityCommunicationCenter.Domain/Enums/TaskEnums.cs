namespace CityCommunicationCenter.Domain.Enums;

public enum JobSourceType
{
    Manual,
    SocialMessage,
    CitizenRequest,
    Integration
}

public enum TaskStatus
{
    Waiting,
    Assigned,
    InProgress,
    PendingCloseApproval,
    Completed,
    Cancelled,
    Rejected,
    RevisionRequested
}

public enum ApprovalDecision
{
    Pending,
    Approved,
    Rejected,
    Returned
}
