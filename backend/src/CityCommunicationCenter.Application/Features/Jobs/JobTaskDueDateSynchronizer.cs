using CityCommunicationCenter.Application.Abstractions;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Jobs;

/// <summary>
/// Talep (Job) ile bağlı aktif görevlerin son tarihini iki yönlü senkron tutar (card #3384).
/// </summary>
internal static class JobTaskDueDateSynchronizer
{
    public static bool DateChangedAtMinutePrecision(DateTimeOffset? previous, DateTimeOffset? next)
    {
        if (previous is null && next is null) return false;
        if (previous is null || next is null) return true;
        return previous.Value.UtcDateTime.Ticks / TimeSpan.TicksPerMinute
            != next.Value.UtcDateTime.Ticks / TimeSpan.TicksPerMinute;
    }

    /// <summary>Talep son tarihi değişince terminal olmayan tüm görevleri günceller.</summary>
    public static async Task SyncActiveTasksFromJobDueDateAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Job job,
        Guid? actorUserId,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        var activeTasks = await LoadActiveTasksAsync(dbContext, tenantId, job.JobId, cancellationToken);

        foreach (var task in activeTasks)
        {
            if (!DateChangedAtMinutePrecision(task.DueDateUtc, job.DueDateUtc))
            {
                continue;
            }

            task.DueDateUtc = job.DueDateUtc;
            task.UpdatedAtUtc = utcNow;
            task.UpdatedByUserId = actorUserId;
            dbContext.AuditLogs.Add(CreateTaskDueDateAudit(tenantId, task, job.DueDateUtc, actorUserId));
        }
    }

    /// <summary>Görev son tarihi değişince talebi ve aynı talepteki diğer aktif görevleri günceller.</summary>
    public static async Task SyncJobAndActiveTasksFromTaskDueDateAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        WorkTask sourceTask,
        Job job,
        Guid? actorUserId,
        DateTimeOffset utcNow,
        CancellationToken cancellationToken)
    {
        if (DateChangedAtMinutePrecision(job.DueDateUtc, sourceTask.DueDateUtc))
        {
            job.DueDateUtc = sourceTask.DueDateUtc;
            job.UpdatedAtUtc = utcNow;
            job.UpdatedByUserId = actorUserId;

            dbContext.AuditLogs.Add(new AuditLog
            {
                AuditLogId = Guid.NewGuid(),
                TenantId = tenantId,
                EntityType = nameof(Job),
                EntityId = job.JobId.ToString(),
                Action = "JobDueDateUpdated",
                ActorUserId = actorUserId,
                StatusAtEvent = job.Status.ToString(),
                Notes = job.DueDateUtc?.ToString("O"),
                Details = job.DueDateUtc?.ToString("O"),
            });
        }

        var activeTasks = await LoadActiveTasksAsync(dbContext, tenantId, job.JobId, cancellationToken);

        foreach (var task in activeTasks)
        {
            if (task.TaskId == sourceTask.TaskId)
            {
                continue;
            }

            if (!DateChangedAtMinutePrecision(task.DueDateUtc, job.DueDateUtc))
            {
                continue;
            }

            task.DueDateUtc = job.DueDateUtc;
            task.UpdatedAtUtc = utcNow;
            task.UpdatedByUserId = actorUserId;
            dbContext.AuditLogs.Add(CreateTaskDueDateAudit(tenantId, task, job.DueDateUtc, actorUserId));
        }
    }

    private static Task<List<WorkTask>> LoadActiveTasksAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken) =>
        dbContext.Tasks
            .Where(task => task.JobId == jobId && task.TenantId == tenantId)
            .Where(task => task.CurrentStatus != WorkflowTaskStatus.Completed
                && task.CurrentStatus != WorkflowTaskStatus.Cancelled
                && task.CurrentStatus != WorkflowTaskStatus.Rejected)
            .ToListAsync(cancellationToken);

    private static AuditLog CreateTaskDueDateAudit(
        Guid tenantId,
        WorkTask task,
        DateTimeOffset? dueDateUtc,
        Guid? actorUserId) =>
        new()
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(WorkTask),
            EntityId = task.TaskId.ToString(),
            Action = "TaskDueDateUpdated",
            ActorUserId = actorUserId,
            StatusAtEvent = task.CurrentStatus.ToString(),
            Notes = dueDateUtc?.ToString("O"),
            Details = dueDateUtc?.ToString("O"),
        };
}
