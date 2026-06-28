using CityCommunicationCenter.Application.Features.Users;
using CityCommunicationCenter.Application.Features.Jobs;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

internal static class TaskWorkflowAuthorization
{
    public static async Task<ApplicationUser> RequireActiveActorAsync(
        IApplicationDbContext dbContext,
        Guid? actorUserId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici dogrulanamadi.");
        }

        var actor = await dbContext.Users
            .FirstOrDefaultAsync(
                entity => entity.UserId == actorUserId.Value && entity.TenantId == tenantId,
                cancellationToken);
        if (actor is null || !actor.IsActive)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici bulunamadi veya aktif degil.");
        }

        return actor;
    }

    public static bool IsSystemAdmin(ApplicationUser actor) => actor.RoleCode == RoleCode.SystemAdmin;

    public static async Task<bool> IsManagerOfAsync(
        IApplicationDbContext dbContext,
        ApplicationUser actor,
        Guid? departmentId,
        CancellationToken cancellationToken)
    {
        if (actor.RoleCode != RoleCode.Manager || !departmentId.HasValue)
        {
            return false;
        }

        // Aktörün birincil birimi eşleşiyorsa yönetici sayılır
        if (actor.DepartmentId == departmentId.Value) return true;

        var department = await dbContext.Departments
            .FirstOrDefaultAsync(
                entity => entity.DepartmentId == departmentId.Value && entity.TenantId == actor.TenantId,
                cancellationToken);
        return department?.ManagerUserId == actor.UserId || department?.DeputyManagerUserId == actor.UserId;
    }

    public static async Task EnsureCanAssignAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Job job,
        Guid? actorUserId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, tenantId, cancellationToken);
        if (IsSystemAdmin(actor)) return;

        if (await IsManagerOfAsync(dbContext, actor, task.AssignedDepartmentId, cancellationToken)) return;
        if (await IsManagerOfAsync(dbContext, actor, job.OwnerDepartmentId, cancellationToken)) return;
        if (JobCitizenRequestHelper.IsCitizenRequest(job)
            && task.AssignedDepartmentId.HasValue
            && await UserRoleAccess.CanManageCitizenRequestInTargetDepartmentAsync(
                dbContext,
                tenantId,
                actor,
                job,
                task.AssignedDepartmentId.Value,
                cancellationToken))
        {
            return;
        }

        throw new ForbiddenAccessException("Bu gorevi atama yetkiniz yok.");
    }

    public static async Task EnsureCanApproveTaskCloseAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Job job,
        Guid? actorUserId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, tenantId, cancellationToken);
        if (IsSystemAdmin(actor)) return;

        if (await IsManagerOfAsync(dbContext, actor, task.AssignedDepartmentId, cancellationToken)) return;
        if (await IsManagerOfAsync(dbContext, actor, job.OwnerDepartmentId, cancellationToken)) return;
        if (JobCitizenRequestHelper.IsCitizenRequest(job)
            && task.AssignedDepartmentId.HasValue
            && await UserRoleAccess.CanManageCitizenRequestInTargetDepartmentAsync(
                dbContext,
                tenantId,
                actor,
                job,
                task.AssignedDepartmentId.Value,
                cancellationToken))
        {
            return;
        }

        throw new ForbiddenAccessException("Bu gorevi onaylama yetkiniz yok.");
    }

    public static async Task EnsureCanActAsAssigneeAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Guid? actorUserId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, tenantId, cancellationToken);
        if (IsSystemAdmin(actor)) return;
        if (task.AssignedUserId == actor.UserId) return;

        throw new ForbiddenAccessException("Bu islem icin gorev atamasinin sizin uzerinizde olmasi gerekir.");
    }

    public static async Task<ApplicationUser> EnsureCanClaimFromPoolAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Guid? actorUserId,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, tenantId, cancellationToken);
        if (!task.AssignedDepartmentId.HasValue ||
            !await UserDepartmentAccess.CanWorkInDepartmentAsync(
                dbContext,
                tenantId,
                actor,
                task.AssignedDepartmentId.Value,
                cancellationToken))
        {
            throw new ForbiddenAccessException("Bu gorevi departman havuzundan sahiplenme yetkiniz yok.");
        }

        return actor;
    }

    public static bool IsClaimableFromDepartmentPool(WorkTask task)
    {
        return task.AssignedDepartmentId.HasValue
            && !task.AssignedUserId.HasValue
            && task.CurrentStatus == WorkflowTaskStatus.Waiting;
    }

    /// <summary>
    /// Recomputes job completion/status based on its tasks.
    /// Returns the new terminal JobStatus if it changed, null otherwise.
    /// </summary>
    public static async Task<Domain.Enums.JobStatus?> RecomputeJobCompletionAsync(
        IApplicationDbContext dbContext,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var job = await dbContext.Jobs.FirstOrDefaultAsync(entity => entity.JobId == jobId, cancellationToken);
        if (job is null) return null;

        var targetDepartments = await dbContext.JobDepartments
            .Where(entity => entity.JobId == jobId && entity.Role == JobDepartmentRole.Target)
            .Select(entity => new TargetDepartmentSnapshot(entity.DepartmentId, entity.ApprovalStatus))
            .ToListAsync(cancellationToken);

        if (job.IsCoordinated || targetDepartments.Count > 1)
        {
            return await RecomputeCoordinatedJobCompletionAsync(dbContext, job, targetDepartments, cancellationToken);
        }

        return await RecomputeStandardJobCompletionAsync(dbContext, job, cancellationToken);
    }

    private sealed record TargetDepartmentSnapshot(Guid DepartmentId, JobApprovalStatus ApprovalStatus);

    private static async Task<Domain.Enums.JobStatus?> RecomputeCoordinatedJobCompletionAsync(
        IApplicationDbContext dbContext,
        Job job,
        IReadOnlyList<TargetDepartmentSnapshot> targetDepartments,
        CancellationToken cancellationToken)
    {
        if (targetDepartments.Count == 0)
        {
            return await RecomputeStandardJobCompletionAsync(dbContext, job, cancellationToken);
        }

        static bool IsParticipating(JobApprovalStatus status) =>
            status is JobApprovalStatus.Approved or JobApprovalStatus.NotRequired;

        var participatingTargetIds = targetDepartments
            .Where(target => IsParticipating(target.ApprovalStatus))
            .Select(target => target.DepartmentId)
            .ToHashSet();

        var allTargetsRejected = targetDepartments.All(target => target.ApprovalStatus == JobApprovalStatus.Rejected);
        if (allTargetsRejected && participatingTargetIds.Count == 0)
        {
            if (job.Status is Domain.Enums.JobStatus.Completed
                or Domain.Enums.JobStatus.Cancelled
                or Domain.Enums.JobStatus.Rejected)
            {
                return null;
            }

            job.Status = Domain.Enums.JobStatus.Cancelled;
            job.CompletionPercentage = 0;
            return Domain.Enums.JobStatus.Cancelled;
        }

        if (participatingTargetIds.Count == 0)
        {
            return null;
        }

        var allTargetsDecided = targetDepartments.All(target =>
            target.ApprovalStatus is JobApprovalStatus.Approved
                or JobApprovalStatus.Rejected
                or JobApprovalStatus.NotRequired);
        if (!allTargetsDecided)
        {
            return null;
        }

        var taskQuery = dbContext.Tasks.Where(entity => entity.JobId == job.JobId);
        if (job.RequestType == JobRequestType.ExternalUnit)
        {
            taskQuery = taskQuery.Where(entity =>
                entity.AssignedDepartmentId.HasValue
                && participatingTargetIds.Contains(entity.AssignedDepartmentId.Value));
        }
        else
        {
            taskQuery = taskQuery.Where(entity =>
                !entity.AssignedDepartmentId.HasValue
                || participatingTargetIds.Contains(entity.AssignedDepartmentId.Value)
                || entity.AssignedDepartmentId == job.OwnerDepartmentId);
        }

        var tasks = await taskQuery
            .Select(entity => new
            {
                entity.AssignedDepartmentId,
                entity.CurrentStatus,
                entity.CompletionPercentage
            })
            .ToListAsync(cancellationToken);

        foreach (var targetId in participatingTargetIds)
        {
            var targetTasks = tasks
                .Where(task => task.AssignedDepartmentId == targetId)
                .ToList();
            if (targetTasks.Count == 0)
            {
                job.CompletionPercentage = tasks.Count == 0
                    ? 0
                    : tasks.Sum(task =>
                        task.CurrentStatus == WorkflowTaskStatus.Completed ? 100 : (task.CompletionPercentage ?? 0)) / tasks.Count;
                return null;
            }

            if (!targetTasks.All(task => task.CurrentStatus == WorkflowTaskStatus.Completed))
            {
                var total = tasks.Sum(task =>
                    task.CurrentStatus == WorkflowTaskStatus.Completed ? 100 : (task.CompletionPercentage ?? 0));
                job.CompletionPercentage = total / tasks.Count;
                return null;
            }
        }

        if (tasks.Count == 0)
        {
            job.CompletionPercentage = 0;
            return null;
        }

        job.CompletionPercentage = 100;
        job.Status = Domain.Enums.JobStatus.Completed;
        job.CompletedAtUtc = DateTimeOffset.UtcNow;
        return Domain.Enums.JobStatus.Completed;
    }

    private static async Task<Domain.Enums.JobStatus?> RecomputeStandardJobCompletionAsync(
        IApplicationDbContext dbContext,
        Job job,
        CancellationToken cancellationToken)
    {
        var tasks = await dbContext.Tasks
            .Where(entity => entity.JobId == job.JobId)
            .Select(entity => new { entity.CurrentStatus, entity.CompletionPercentage })
            .ToListAsync(cancellationToken);
        if (tasks.Count == 0)
        {
            job.CompletionPercentage = 0;
            return null;
        }

        var total = tasks.Sum(t =>
            t.CurrentStatus == WorkflowTaskStatus.Completed ? 100 : (t.CompletionPercentage ?? 0));
        job.CompletionPercentage = total / tasks.Count;

        var allTerminal = tasks.All(t =>
            t.CurrentStatus is WorkflowTaskStatus.Completed
                or WorkflowTaskStatus.Cancelled
                or WorkflowTaskStatus.Rejected);

        if (!allTerminal) return null;

        var allCancelled = tasks.All(t => t.CurrentStatus == WorkflowTaskStatus.Cancelled);
        var allCompleted = tasks.All(t => t.CurrentStatus == WorkflowTaskStatus.Completed);

        if (allCancelled)
        {
            if (job.Status == Domain.Enums.JobStatus.Cancelled)
            {
                return null;
            }

            job.Status = Domain.Enums.JobStatus.Cancelled;
            job.CompletedAtUtc = null;
            job.CompletionPercentage = 0;
            return Domain.Enums.JobStatus.Cancelled;
        }

        if (allCompleted)
        {
            if (job.Status == Domain.Enums.JobStatus.Completed)
            {
                return null;
            }

            job.Status = Domain.Enums.JobStatus.Completed;
            job.CompletedAtUtc = DateTimeOffset.UtcNow;
            return Domain.Enums.JobStatus.Completed;
        }

        // Karışık terminal durum (ör. bir görev tamamlanmış, diğeri iptal) — talep tamamlanmış sayılmaz.
        if (job.Status is Domain.Enums.JobStatus.Completed or Domain.Enums.JobStatus.Cancelled or Domain.Enums.JobStatus.Rejected)
        {
            job.Status = Domain.Enums.JobStatus.Active;
            job.CompletedAtUtc = null;
            return Domain.Enums.JobStatus.Active;
        }

        return null;
    }
}
