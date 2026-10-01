using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Domain.Enums;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.CitizenMessageApprovals;

internal static class CitizenMessageApprovalTaskAttachmentAudit
{
    public const string Action = "CitizenMessageApprovalTaskAttachmentEdited";

    public static async Task TryWriteAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        string entityType,
        Guid entityId,
        Guid? actorUserId,
        string details,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(entityType, "Task", StringComparison.OrdinalIgnoreCase)
            || actorUserId is not Guid userId)
        {
            return;
        }

        var actor = await dbContext.Users.AsNoTracking()
            .FirstOrDefaultAsync(user => user.UserId == userId && user.TenantId == tenantId, cancellationToken);
        if (actor is null
            || (actor.RoleCode is not (RoleCode.SystemAdmin or RoleCode.Manager)
                && !UserRoleAccess.IsCitizenRequestManager(actor)))
        {
            return;
        }

        var task = await dbContext.Tasks.AsNoTracking()
            .FirstOrDefaultAsync(item => item.TaskId == entityId && item.TenantId == tenantId, cancellationToken);
        if (task is null
            || task.CurrentStatus is not (WorkflowTaskStatus.Completed or WorkflowTaskStatus.Cancelled or WorkflowTaskStatus.Rejected))
        {
            return;
        }

        var job = await dbContext.Jobs.AsNoTracking()
            .FirstOrDefaultAsync(item => item.JobId == task.JobId && item.TenantId == tenantId, cancellationToken);
        if (job is null || job.CitizenTerminalMessageReleasedAtUtc.HasValue)
        {
            return;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            AuditLogId = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = nameof(Job),
            EntityId = job.JobId.ToString(),
            Action = Action,
            ActorUserId = actor.UserId,
            ActorDisplayName = actor.DisplayName,
            StatusAtEvent = job.Status.ToString(),
            Notes = details,
            Details = details,
        });
    }

    public static async Task<string?> ResolveEditorDisplayNameAsync(
        IApplicationDbContext dbContext,
        Guid tenantId,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        return await dbContext.AuditLogs.AsNoTracking()
            .Where(log => log.TenantId == tenantId
                && log.EntityType == nameof(Job)
                && log.EntityId == jobId.ToString()
                && log.Action == Action)
            .OrderByDescending(log => log.CreatedAtUtc)
            .Select(log => log.ActorDisplayName)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
