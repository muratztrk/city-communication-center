using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

internal static class TaskWorkflowAuthorization
{
    public static async Task EnsureCanApproveOrRejectAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, cancellationToken);
        if (IsSystemAdmin(actor))
        {
            return;
        }

        await EnsureDepartmentManagerAccessAsync(
            dbContext,
            actor,
            GetWorkflowDepartmentId(task),
            "Bu gorev icin onay yetkiniz yok.",
            cancellationToken);
    }

    public static async Task EnsureCanAssignAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, cancellationToken);
        if (IsSystemAdmin(actor))
        {
            return;
        }

        await EnsureDepartmentManagerAccessAsync(
            dbContext,
            actor,
            GetWorkflowDepartmentId(task),
            "Bu gorevi atama veya yeniden yonlendirme yetkiniz yok.",
            cancellationToken);
    }

    public static async Task EnsureCanCompleteAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, cancellationToken);
        if (IsSystemAdmin(actor) || task.AssignedUserId == actor.UserId)
        {
            return;
        }

        await EnsureDepartmentManagerAccessAsync(
            dbContext,
            actor,
            GetWorkflowDepartmentId(task),
            "Bu gorevi tamamlama yetkiniz yok.",
            cancellationToken);
    }

    public static async Task EnsureCanCloseAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, cancellationToken);
        if (IsSystemAdmin(actor))
        {
            return;
        }

        await EnsureDepartmentManagerAccessAsync(
            dbContext,
            actor,
            GetWorkflowDepartmentId(task),
            "Bu gorevi kapatma yetkiniz yok.",
            cancellationToken);
    }

    public static async Task<ApplicationUser> EnsureCanClaimFromPoolAsync(
        IApplicationDbContext dbContext,
        WorkTask task,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        var actor = await RequireActiveActorAsync(dbContext, actorUserId, cancellationToken);
        if (!task.AssignedDepartmentId.HasValue || actor.DepartmentId != task.AssignedDepartmentId.Value)
        {
            throw new ForbiddenAccessException("Bu gorevi departman havuzundan sahiplenme yetkiniz yok.");
        }

        return actor;
    }

    public static bool IsClaimableFromDepartmentPool(WorkTask task)
    {
        return task.AssignedDepartmentId.HasValue
            && !task.AssignedUserId.HasValue
            && task.CurrentStatus == WorkflowTaskStatus.Assigned;
    }

    private static async Task<ApplicationUser> RequireActiveActorAsync(
        IApplicationDbContext dbContext,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici dogrulanamadi.");
        }

        var actor = await dbContext.Users
            .FirstOrDefaultAsync(entity => entity.UserId == actorUserId.Value, cancellationToken);
        if (actor is null || !actor.IsActive)
        {
            throw new ForbiddenAccessException("Islemi gerceklestiren kullanici bulunamadi veya aktif degil.");
        }

        return actor;
    }

    private static async Task EnsureDepartmentManagerAccessAsync(
        IApplicationDbContext dbContext,
        ApplicationUser actor,
        Guid? departmentId,
        string forbiddenMessage,
        CancellationToken cancellationToken)
    {
        if (!departmentId.HasValue)
        {
            throw new ForbiddenAccessException(forbiddenMessage);
        }

        var department = await dbContext.Departments
            .FirstOrDefaultAsync(entity => entity.DepartmentId == departmentId.Value, cancellationToken);
        if (department?.ManagerUserId != actor.UserId || actor.RoleCode != RoleCode.Manager)
        {
            throw new ForbiddenAccessException(forbiddenMessage);
        }
    }

    private static Guid? GetWorkflowDepartmentId(WorkTask task)
    {
        return task.AssignedDepartmentId ?? task.TargetDepartmentId;
    }

    private static bool IsSystemAdmin(ApplicationUser actor)
    {
        return actor.RoleCode == RoleCode.SystemAdmin;
    }
}