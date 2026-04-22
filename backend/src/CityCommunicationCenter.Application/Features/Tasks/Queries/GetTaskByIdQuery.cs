namespace CityCommunicationCenter.Application.Features.Tasks;

public sealed record GetTaskByIdQuery(Guid TaskId) : IQuery<TaskDetailResponse?>;

public sealed class GetTaskByIdQueryHandler : IRequestHandler<GetTaskByIdQuery, TaskDetailResponse?>
{
    private readonly IApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;

    public GetTaskByIdQueryHandler(IApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
    }

    public async Task<TaskDetailResponse?> Handle(GetTaskByIdQuery request, CancellationToken cancellationToken)
    {
        var context = _tenantContextAccessor.GetCurrent();
        var tenantId = context.TenantId ?? throw new InvalidOperationException("Tenant context is required.");
        var task = await _dbContext.Tasks.FirstOrDefaultAsync(entity => entity.TaskId == request.TaskId, cancellationToken);
        if (task is null) return null;

        var jobTitle = await _dbContext.Jobs
            .Where(entity => entity.JobId == task.JobId)
            .Select(entity => entity.Title)
            .FirstOrDefaultAsync(cancellationToken);

        var createdByName = task.CreatedByUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == task.CreatedByUserId.Value)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var ownerDisplayName = task.OwnerUserId.HasValue
            ? await _dbContext.Users.AsNoTracking()
                .Where(u => u.UserId == task.OwnerUserId.Value)
                .Select(u => u.DisplayName)
                .FirstOrDefaultAsync(cancellationToken)
            : null;

        var approvals = await _dbContext.Approvals
            .Where(entity => entity.TenantId == tenantId
                && (
                    (entity.SubjectType == ApprovalSubjectType.Task && entity.SubjectId == request.TaskId)
                    || (entity.SubjectType == ApprovalSubjectType.TaskClose && entity.SubjectId == request.TaskId)
                    || (entity.SubjectType == ApprovalSubjectType.TaskRevision && entity.SubjectId == request.TaskId)))
            .OrderBy(entity => entity.StepOrder)
            .ToListAsync(cancellationToken);
        var assignmentHistory = await _dbContext.AssignmentHistories
            .Where(entity => entity.TenantId == tenantId && entity.TaskId == request.TaskId)
            .OrderBy(entity => entity.ActionDateUtc)
            .ToListAsync(cancellationToken);

        return new TaskDetailResponse(
            task.TaskId,
            task.TenantId,
            task.JobId,
            jobTitle,
            task.Title,
            task.Description,
            task.Priority,
            task.CurrentStatus.ToString(),
            task.AssignedDepartmentId,
            task.AssignedUserId,
            task.StartDateUtc,
            task.DueDateUtc,
            task.CompletedAtUtc,
            task.CompletionPercentage,
            task.EstimatedHours,
            task.ActualHours,
            task.Notes,
            task.RevisionReason,
            createdByName,
            task.CreatedAtUtc,
            approvals
                .OrderBy(entity => entity.StepOrder)
                .Select(entity => new ApprovalStepResponse(
                    entity.ApprovalId,
                    entity.SubjectType.ToString(),
                    entity.SubjectId,
                    entity.ApproverUserId,
                    entity.StepOrder,
                    entity.Decision.ToString(),
                    entity.DecisionDateUtc,
                    entity.Comment))
                .ToArray(),
            assignmentHistory
                .OrderByDescending(entity => entity.ActionDateUtc)
                .Select(entity => new AssignmentHistoryResponse(
                    entity.AssignmentId,
                    entity.FromDepartmentId,
                    entity.ToDepartmentId,
                    entity.FromUserId,
                    entity.ToUserId,
                    entity.ActionType,
                    entity.ActionDateUtc))
                .ToArray(),
            ownerDisplayName);
    }
}
