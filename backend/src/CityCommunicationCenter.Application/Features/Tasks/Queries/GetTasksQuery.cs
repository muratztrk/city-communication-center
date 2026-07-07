using CityCommunicationCenter.Application.Features.Users;
using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record GetTasksQuery(string? Scope) : IQuery<IReadOnlyList<TaskSummaryResponse>>;

public sealed class GetTasksQueryHandler : IQueryHandler<GetTasksQuery, IReadOnlyList<TaskSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetTasksQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async ValueTask<IReadOnlyList<TaskSummaryResponse>> Handle(GetTasksQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.RequireTenantId();
        var scope = TaskQueryScopeParser.Parse(request.Scope);
        var actor = await ResolveActorAsync(tenantId, context.UserId, cancellationToken);
        var allManagedDepartmentIds = actor?.RoleCode == RoleCode.Manager
            ? await _dbContext.Departments
                .AsNoTracking()
                .Where(entity => entity.TenantId == tenantId && entity.ManagerUserId == actor.UserId)
                .Select(entity => entity.DepartmentId)
                .ToArrayAsync(cancellationToken)
            : [];
        var managedDepartmentIds = context.ActiveDepartmentId.HasValue
            ? allManagedDepartmentIds.Contains(context.ActiveDepartmentId.Value)
                ? [context.ActiveDepartmentId.Value]
                : []
            : allManagedDepartmentIds;
        var isCitizenRequestManager = actor is not null && UserRoleAccess.IsCitizenRequestManager(actor);
        var accessibleDepartmentIds = actor is null
            ? []
            : await UserDepartmentAccess.GetScopedDepartmentIdsAsync(_dbContext, tenantId, actor, context.ActiveDepartmentId, cancellationToken);

        IQueryable<WorkTask> tasks = _dbContext.Tasks
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId);

        tasks = scope switch
        {
            TaskQueryScope.All => actor is null
                ? tasks.Where(_ => false)
                : actor.RoleCode switch
                {
                    RoleCode.SystemAdmin => tasks,
                    RoleCode.Manager => accessibleDepartmentIds.Length == 0
                        ? tasks.Where(entity => entity.AssignedUserId == actor.UserId || entity.CreatedByUserId == actor.UserId)
                        : tasks.Where(entity =>
                            entity.AssignedUserId == actor.UserId ||
                            entity.CreatedByUserId == actor.UserId ||
                            (entity.AssignedDepartmentId.HasValue && accessibleDepartmentIds.Contains(entity.AssignedDepartmentId.Value)) ||
                            _dbContext.Jobs.Any(job => job.JobId == entity.JobId && accessibleDepartmentIds.Contains(job.OwnerDepartmentId))),
                    _ => tasks.Where(entity => entity.AssignedUserId == actor.UserId || entity.CreatedByUserId == actor.UserId)
                },
            TaskQueryScope.Mine => actor is null
                ? tasks.Where(_ => false)
                : tasks.Where(entity => entity.AssignedUserId == actor.UserId),
            TaskQueryScope.DepartmentPool => actor is null
                ? tasks.Where(_ => false)
                : tasks.Where(entity =>
                    entity.AssignedDepartmentId.HasValue &&
                    accessibleDepartmentIds.Contains(entity.AssignedDepartmentId.Value) &&
                    entity.AssignedUserId == null &&
                    entity.CurrentStatus == WorkflowTaskStatus.Waiting),
            TaskQueryScope.PendingApproval => actor is null
                ? tasks.Where(_ => false)
                : actor.RoleCode switch
                {
                    RoleCode.SystemAdmin => tasks.Where(entity => entity.CurrentStatus == WorkflowTaskStatus.Waiting),
                    RoleCode.Manager => managedDepartmentIds.Length == 0
                        ? tasks.Where(_ => false)
                        : tasks.Where(entity =>
                            entity.CurrentStatus == WorkflowTaskStatus.Waiting &&
                            entity.AssignedDepartmentId.HasValue &&
                            managedDepartmentIds.Contains(entity.AssignedDepartmentId!.Value)),
                    _ => tasks.Where(_ => false)
                },
            TaskQueryScope.Department => actor is null
                ? tasks.Where(_ => false)
                : accessibleDepartmentIds.Length == 0
                    ? tasks.Where(_ => false)
                    : tasks.Where(entity =>
                        entity.AssignedDepartmentId.HasValue &&
                        accessibleDepartmentIds.Contains(entity.AssignedDepartmentId.Value) &&
                        (!isCitizenRequestManager || _dbContext.Jobs.Any(job =>
                            job.JobId == entity.JobId &&
                            (job.RequestType == JobRequestType.Citizen ||
                             job.SourceType == JobSourceType.SocialMessage ||
                             job.SourceType == JobSourceType.CitizenRequest ||
                             job.SourceType == JobSourceType.EDevlet)))),
            _ => tasks
        };

        return await tasks
            .OrderByDescending(task => task.CreatedAtUtc)
            .Select(task => new TaskSummaryResponse(
                task.TaskId,
                task.TenantId,
                task.JobId,
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .Select(job => (string?)job.Title)
                    .FirstOrDefault(),
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .Select(job => (string?)job.RequestType.ToString())
                    .FirstOrDefault(),
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .Select(job => (string?)job.SourceType.ToString())
                    .FirstOrDefault(),
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .Select(job => job.JobNumber)
                    .FirstOrDefault(),
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .Select(job => job.JobNumberYear)
                    .FirstOrDefault(),
                task.Title,
                task.Priority,
                task.CurrentStatus.ToString(),
                task.AssignedDepartmentId,
                _dbContext.Departments
                    .AsNoTracking()
                    .Where(assignedDepartment => assignedDepartment.DepartmentId == task.AssignedDepartmentId)
                    .Select(assignedDepartment => (string?)assignedDepartment.Name)
                    .FirstOrDefault(),
                task.AssignedUserId,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(assignedUser => assignedUser.UserId == task.AssignedUserId)
                    .Select(assignedUser => (string?)assignedUser.DisplayName)
                    .FirstOrDefault(),
                task.DueDateUtc,
                task.CompletionPercentage,
                task.EstimatedHours,
                task.ActualHours,
                // "Oluşturan" = talebi oluşturan kişi (işin sahibi), görevi onaylayan/atayan değil.
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .SelectMany(job => _dbContext.Users
                        .Where(createdByUser => createdByUser.UserId == job.CreatedByUserId)
                        .Select(createdByUser => (string?)createdByUser.DisplayName))
                    .FirstOrDefault(),
                task.CreatedAtUtc,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(ownerUser => ownerUser.UserId == task.OwnerUserId)
                    .Select(ownerUser => (string?)ownerUser.DisplayName)
                    .FirstOrDefault(),
                task.TaskNumber,
                task.TaskNumberYear,
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .SelectMany(job => _dbContext.Departments
                        .Where(dept => dept.DepartmentId == job.OwnerDepartmentId)
                        .Select(dept => (string?)dept.Name))
                    .FirstOrDefault(),
                task.CompletedAtUtc,
                task.UpdatedAtUtc,
                // Talebi oluşturan kullanıcının rolü (ör. Üst Düzey Yönetici = Reporter).
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .SelectMany(job => _dbContext.Users
                        .Where(u => u.UserId == job.CreatedByUserId)
                        .Select(u => (string?)u.RoleCode.ToString()))
                    .FirstOrDefault(),
                task.OwnerUserId,
                // Görevin atanan kullanıcıya atandığı an — "Yeni" rozeti bugünse gösterilir (card 589).
                task.AssignedAtUtc,
                // "Talep Tarihi" = bağlı talebin oluşturulma tarihi; birim içi talepler onaylanınca
                // görev o an oluştuğu için görevin değil talebin tarihi gösterilir (card 629).
                _dbContext.Jobs
                    .AsNoTracking()
                    .Where(job => job.JobId == task.JobId)
                    .Select(job => (DateTimeOffset?)job.CreatedAtUtc)
                    .FirstOrDefault(),
                // Yöneticide bekleyen ek süre talebi var mı — gridview "(Ek süre talebi)" işareti (card 628).
                _dbContext.Approvals.Any(approval =>
                    approval.SubjectType == ApprovalSubjectType.TaskRevision
                    && approval.SubjectId == task.TaskId
                    && approval.Decision == ApprovalDecision.Pending),
                // Birden fazla ek süre talebi olabileceğinden, yalnızca en son sonuçlanan karar gösterilir.
                _dbContext.Approvals
                    .Where(approval => approval.SubjectType == ApprovalSubjectType.TaskRevision
                        && approval.SubjectId == task.TaskId
                        && approval.Decision != ApprovalDecision.Pending)
                    .OrderByDescending(approval => approval.DecisionDateUtc)
                    .Select(approval => (string?)approval.Decision.ToString())
                    .FirstOrDefault(),
                // Görevi atayan yöneticinin adı — Görevlerim'de "kendine atayan yönetici düzenleyebilir"
                // istisnasının grid'de de çalışması için (card #1476).
                _dbContext.Users
                    .AsNoTracking()
                    .Where(assigningManager => assigningManager.UserId == task.AssigningManagerId)
                    .Select(assigningManager => (string?)assigningManager.DisplayName)
                    .FirstOrDefault(),
                null,
                null,
                _dbContext.JobDepartments
                    .AsNoTracking()
                    .Where(department => department.JobId == task.JobId
                        && department.Role == JobDepartmentRole.Target
                        && department.DepartmentId == task.AssignedDepartmentId
                        && department.Notes != null
                        && department.Notes != "")
                    .Select(department => department.Notes)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);
    }

    private async Task<ApplicationUser?> ResolveActorAsync(
        Guid tenantId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (!actorUserId.HasValue)
        {
            return null;
        }

        return await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                entity => entity.UserId == actorUserId.Value && entity.TenantId == tenantId && entity.IsActive,
                cancellationToken);
    }
}

internal enum TaskQueryScope
{
    All,
    Mine,
    Department,
    DepartmentPool,
    PendingApproval
}

internal static class TaskQueryScopeParser
{
    public static TaskQueryScope Parse(string? scope)
    {
        if (string.IsNullOrWhiteSpace(scope))
        {
            return TaskQueryScope.All;
        }

        return scope.Trim().ToLowerInvariant() switch
        {
            "all" => TaskQueryScope.All,
            "mine" => TaskQueryScope.Mine,
            "department" => TaskQueryScope.Department,
            "department-pool" => TaskQueryScope.DepartmentPool,
            "pending-approval" => TaskQueryScope.PendingApproval,
            _ => throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(scope), "Gecersiz gorev scope degeri.")
            ])
        };
    }
}
