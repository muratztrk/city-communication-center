using CityCommunicationCenter.Application.Features.Users;
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

    public static async Task RecomputeJobCompletionAsync(
        IApplicationDbContext dbContext,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        var job = await dbContext.Jobs.FirstOrDefaultAsync(entity => entity.JobId == jobId, cancellationToken);
        if (job is null) return;

        var tasks = await dbContext.Tasks
            .Where(entity => entity.JobId == jobId)
            .Select(entity => new { entity.CurrentStatus, entity.CompletionPercentage })
            .ToListAsync(cancellationToken);
        if (tasks.Count == 0)
        {
            job.CompletionPercentage = 0;
            return;
        }

        var total = tasks.Sum(t =>
            t.CurrentStatus == WorkflowTaskStatus.Completed ? 100 : (t.CompletionPercentage ?? 0));
        job.CompletionPercentage = total / tasks.Count;

        if (tasks.All(t => t.CurrentStatus == WorkflowTaskStatus.Completed))
        {
            job.Status = Domain.Enums.JobStatus.Completed;
            job.CompletedAtUtc = DateTimeOffset.UtcNow;
        }
    }
}
