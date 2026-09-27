namespace CityCommunicationCenter.Application.Features.Jobs;

internal static class JobDueDateOverdueHelper
{
    public static bool IsOverdue(JobStatus status, DateTimeOffset? dueDateUtc, DateTimeOffset utcNow)
    {
        if (!dueDateUtc.HasValue)
        {
            return false;
        }

        if (status is JobStatus.PendingOwnerApproval or JobStatus.PendingExternalApproval)
        {
            return IsDueDatePastCalendarDay(dueDateUtc.Value, utcNow);
        }

        return dueDateUtc.Value < utcNow;
    }

    public static void StampHadOverdueIfApplicable(Job job, DateTimeOffset utcNow)
    {
        if (job.Status is JobStatus.Completed or JobStatus.Cancelled or JobStatus.Rejected)
        {
            return;
        }

        if (IsOverdue(job.Status, job.DueDateUtc, utcNow))
        {
            job.HadOverdueDueDate = true;
        }
    }

    private static bool IsDueDatePastCalendarDay(DateTimeOffset dueDateUtc, DateTimeOffset utcNow)
    {
        var dueLocal = dueDateUtc.UtcDateTime;
        var nowLocal = utcNow.UtcDateTime;
        var dueDay = DateOnly.FromDateTime(dueLocal);
        var today = DateOnly.FromDateTime(nowLocal);
        return dueDay < today;
    }
}
