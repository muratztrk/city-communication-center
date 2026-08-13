namespace CityCommunicationCenter.Application.Features.Notifications;

/// <summary>
/// Bildirim feed'i ve okunmamış sayaç için ortak audit görünürlük kuralları (#2564).
/// </summary>
internal static class NotificationAuditRules
{
    public static bool ShouldCountAuditAsUnread(AuditLog audit, Guid userId)
    {
        if (audit.ActorUserId == userId)
        {
            return false;
        }

        if (audit.Action == "RoutineTaskCreated" || audit.Action.StartsWith("CitizenMessage", StringComparison.Ordinal))
        {
            return false;
        }

        if (IsJobStatusSideEffectOfTaskChange(audit))
        {
            return false;
        }

        if (!IsRecognizedNotificationAction(audit.Action))
        {
            return false;
        }

        return true;
    }

    public static bool IsJobStatusSideEffectOfTaskChange(AuditLog audit) =>
        audit.EntityType == nameof(Job)
        && !string.IsNullOrWhiteSpace(audit.Notes)
        && (audit.Notes.Contains("Görev durumu değişikliği sonucu talep durumu güncellendi", StringComparison.Ordinal)
            || audit.Notes.Contains("Görev iptali sonucu talep durumu güncellendi", StringComparison.Ordinal));

    private static bool IsRecognizedNotificationAction(string action) => action switch
    {
        "JobCreated" or "JobUpdated" or "JobDueDateUpdated" or "JobCancelled" or "JobDeleted"
            or "JobOwnerApproved" or "JobOwnerRejected" or "JobTargetApproved" or "JobTargetRejected"
            or "JobTargetForwarded" or "JobReturnRequested" or "JobReturnedToPending" or "JobSupportAdded"
            or "JobManagerNoteAdded" or "JobManagerNoteDeleted" or "JobCompleted"
            or "TaskCreated" or "RoutineTaskCreated" or "RoutineTaskUpdated" or "RoutineTaskEditSnapshot"
            or "TaskAssigned" or "TaskClaimedFromPool" or "TaskProgressUpdated" or "TaskDueDateUpdated"
            or "TaskCompleted" or "TaskCancelled" or "TaskRevisionRequested" or "TaskExtraTimeRequested"
            or "TaskRevisionApproved" or "TaskExtraTimeApproved" or "TaskRevisionRejected" or "TaskExtraTimeRejected"
            or "TaskCloseApproved" or "TaskCloseRejected" or "TaskStatusChanged"
            or "CoordinatingDepartmentsAdded" or "DepartmentCreated" or "DepartmentUpdated" or "DepartmentDeleted"
            or "DirectorySyncRequested" => true,
        _ when action.StartsWith("Task", StringComparison.Ordinal) => true,
        _ when action.StartsWith("Job", StringComparison.Ordinal) => true,
        _ => false,
    };
}
