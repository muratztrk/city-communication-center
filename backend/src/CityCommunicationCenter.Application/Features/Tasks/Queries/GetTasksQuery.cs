using WorkflowTaskStatus = CityCommunicationCenter.Domain.Enums.TaskStatus;

namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record GetTasksQuery(string? Scope) : IQuery<IReadOnlyList<TaskSummaryResponse>>;

public sealed class GetTasksQueryHandler : IRequestHandler<GetTasksQuery, IReadOnlyList<TaskSummaryResponse>>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetTasksQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<IReadOnlyList<TaskSummaryResponse>> Handle(GetTasksQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var scope = TaskQueryScopeParser.Parse(request.Scope);
        var actor = await ResolveActorAsync(scope, context.UserId, cancellationToken);
        var managedDepartmentIds = actor?.RoleCode == RoleCode.Manager
            ? await _dbContext.Departments
                .AsNoTracking()
                .Where(entity => entity.ManagerUserId == actor.UserId)
                .Select(entity => entity.DepartmentId)
                .ToArrayAsync(cancellationToken)
            : [];

        IQueryable<WorkTask> tasks = _dbContext.Tasks.AsNoTracking();

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

        return await (
            from task in tasks
            join job in _dbContext.Jobs.AsNoTracking()
                on task.JobId equals job.JobId into jobs
            from job in jobs.DefaultIfEmpty()
            join assignedDepartment in _dbContext.Departments.AsNoTracking()
                on task.AssignedDepartmentId equals assignedDepartment.DepartmentId into assignedDepartments
            from assignedDepartment in assignedDepartments.DefaultIfEmpty()
            join assignedUser in _dbContext.Users.AsNoTracking()
                on task.AssignedUserId equals assignedUser.UserId into assignedUsers
            from assignedUser in assignedUsers.DefaultIfEmpty()
            orderby task.CreatedAtUtc descending
            select new TaskSummaryResponse(
                task.TaskId,
                task.TenantId,
                task.JobId,
                job != null ? job.Title : null,
                task.Title,
                task.Priority,
                task.CurrentStatus.ToString(),
                task.AssignedDepartmentId,
                assignedDepartment != null ? assignedDepartment.Name : null,
                task.AssignedUserId,
                assignedUser != null ? assignedUser.DisplayName : null,
                task.DueDateUtc,
                task.CompletionPercentage,
                task.EstimatedHours,
                task.ActualHours))
            .ToListAsync(cancellationToken);
    }

    private async Task<ApplicationUser?> ResolveActorAsync(
        TaskQueryScope scope,
        Guid? actorUserId,
        CancellationToken cancellationToken)
    {
        if (scope == TaskQueryScope.All || !actorUserId.HasValue)
        {
            return null;
        }

        return await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(entity => entity.UserId == actorUserId.Value && entity.IsActive, cancellationToken);
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
