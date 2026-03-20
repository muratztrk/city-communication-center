
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
        if (task is null)
        {
            return null;
        }

        var approvals = await _dbContext.Approvals
            .Where(entity => entity.TenantId == tenantId && entity.TaskId == request.TaskId)
            .OrderBy(entity => entity.StepOrder)
            .ToListAsync(cancellationToken);
        var assignmentHistory = await _dbContext.AssignmentHistories
            .Where(entity => entity.TenantId == tenantId && entity.TaskId == request.TaskId)
            .OrderBy(entity => entity.ActionDateUtc)
            .ToListAsync(cancellationToken);

        return new TaskDetailResponse(
            task.TaskId,
            task.TenantId,
            task.Title,
            task.Description,
            task.TaskType.ToString(),
            task.SourceType.ToString(),
            task.Priority,
            task.CurrentStatus.ToString(),
            task.SourceRefId,
            task.TargetDepartmentId,
            task.AssignedDepartmentId,
            task.AssignedUserId,
            task.DueDateUtc,
            approvals
                .OrderBy(entity => entity.StepOrder)
                .Select(entity => new ApprovalStepResponse(
                    entity.ApprovalId,
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
                .ToArray());
    }
}