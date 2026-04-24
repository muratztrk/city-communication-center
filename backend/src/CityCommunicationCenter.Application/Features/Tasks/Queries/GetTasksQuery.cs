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
        var actor = await ResolveActorAsync(scope, tenantId, context.UserId, cancellationToken);
        var managedDepartmentIds = actor?.RoleCode == RoleCode.Manager
            ? await _dbContext.Departments
                .AsNoTracking()
                .Where(entity => entity.TenantId == tenantId && entity.ManagerUserId == actor.UserId)
                .Select(entity => entity.DepartmentId)
                .ToArrayAsync(cancellationToken)
            : [];

        IQueryable<WorkTask> tasks = _dbContext.Tasks
            .AsNoTracking()
            .Where(entity => entity.TenantId == tenantId);

        tasks = scope switch
        {
            TaskQueryScope.All => tasks,
            TaskQueryScope.Mine => actor is null
                ? tasks.Where(_ => false)
                : tasks.Where(entity => entity.AssignedUserId == actor.UserId),
            TaskQueryScope.DepartmentPool => actor is null
                ? tasks.Where(_ => false)
                : tasks.Where(entity =>
                    entity.AssignedDepartmentId == actor.DepartmentId &&
                    entity.AssignedUserId == null &&
                    entity.CurrentStatus == WorkflowTaskStatus.Waiting),
            TaskQueryScope.PendingCloseApproval => actor is null
                ? tasks.Where(_ => false)
                : actor.RoleCode switch
                {
                    RoleCode.SystemAdmin => tasks.Where(entity => entity.CurrentStatus == WorkflowTaskStatus.PendingCloseApproval),
                    RoleCode.Manager => managedDepartmentIds.Length == 0
                        ? tasks.Where(_ => false)
                        : tasks.Where(entity =>
                            entity.CurrentStatus == WorkflowTaskStatus.PendingCloseApproval &&
                            entity.AssignedDepartmentId.HasValue &&
                            managedDepartmentIds.Contains(entity.AssignedDepartmentId!.Value)),
                    _ => tasks.Where(_ => false)
                },
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
                _dbContext.Users
                    .AsNoTracking()
                    .Where(createdByUser => createdByUser.UserId == task.CreatedByUserId)
                    .Select(createdByUser => (string?)createdByUser.DisplayName)
                    .FirstOrDefault(),
                task.CreatedAtUtc,
                _dbContext.Users
                    .AsNoTracking()
                    .Where(ownerUser => ownerUser.UserId == task.OwnerUserId)
                    .Select(ownerUser => (string?)ownerUser.DisplayName)
                    .FirstOrDefault()))
            .ToListAsync(cancellationToken);
    }

    private async Task<ApplicationUser?> ResolveActorAsync(
        TaskQueryScope scope,
        Guid tenantId,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (scope == TaskQueryScope.All || !actorUserId.HasValue)
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
    DepartmentPool,
    PendingCloseApproval
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
            "department-pool" => TaskQueryScope.DepartmentPool,
            "pending-close-approval" => TaskQueryScope.PendingCloseApproval,
            _ => throw new ValidationException([
                new FluentValidation.Results.ValidationFailure(nameof(scope), "Gecersiz gorev scope degeri.")
            ])
        };
    }
}
