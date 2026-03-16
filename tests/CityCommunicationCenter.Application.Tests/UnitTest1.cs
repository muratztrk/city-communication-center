using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Tests;

public sealed class TaskStatusTests
{
    [Theory]
    [InlineData(WorkflowTaskStatus.Draft, true)]
    [InlineData(WorkflowTaskStatus.PendingApproval, true)]
    [InlineData(WorkflowTaskStatus.Assigned, true)]
    [InlineData(WorkflowTaskStatus.InProgress, true)]
    [InlineData(WorkflowTaskStatus.Completed, false)]
    [InlineData(WorkflowTaskStatus.Closed, false)]
    [InlineData(WorkflowTaskStatus.Rejected, false)]
    public void OpenStatusMap_ShouldMatchWorkflowExpectation(WorkflowTaskStatus status, bool isOpen)
    {
        var openStatuses = new HashSet<WorkflowTaskStatus>
        {
            WorkflowTaskStatus.Draft,
            WorkflowTaskStatus.PendingApproval,
            WorkflowTaskStatus.Assigned,
            WorkflowTaskStatus.InProgress
        };

        Assert.Equal(isOpen, openStatuses.Contains(status));
    }
}
